import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";
import { mapLimit } from "@/lib/gmail/client";
import { compileSearch, type CompiledQuery } from "@/lib/search/compile";
import { expandLabelQuery } from "@/lib/gmail/labels";
import { addThreadContext, groupThreads } from "@/lib/search/threads";
import { rerankThreads, scoreOf, type Signals } from "@/lib/search/rerank";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";

export const maxDuration = 120;

export type SignalName = keyof Signals;

/** The signal the user's question is really about, shown first and used for the likely/unsure/unlikely split. */
export function primarySignal(c: CompiledQuery | null): SignalName | null {
  if (!c) return null;
  if (c.rerank.waiting) return "waiting";
  if (c.rerank.needsReply) return "needsReply";
  if (c.rerank.relevance) return "relevance";
  if (c.rerank.disposable) return "disposable";
  if (c.rerank.urgency) return "urgency";
  if (c.rerank.human) return "human";
  return null;
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { q?: string; gmail?: string; limit?: number; rerank?: boolean };
  const limit = Math.min(Math.max(body.limit ?? 60, 1), 120);
  try {
    const { gmail, email } = await gmailFor(userId);
    const known = await db.select({ domain: schema.senderProfiles.domain, name: schema.senderProfiles.displayName }).from(schema.senderProfiles).where(eq(schema.senderProfiles.userId, userId));
    const labels = await gmail.listLabels();
    const labelNames = new Set(labels.map((l) => l.name));
    const idToLabel = new Map(labels.map((l) => [l.id, l.name]));
    let compiled: CompiledQuery | null = null;
    let gmailQuery = body.gmail?.trim();
    if (!gmailQuery) {
      if (!body.q?.trim()) return NextResponse.json({ error: "empty query" }, { status: 400 });
      compiled = await compileSearch(body.q, { knownSenders: known, hasLabel: (n) => labelNames.has(n) });
      // Gmail does not search into nested labels, so reach the user's "Receipts/Uber" from "Receipts".
      gmailQuery = expandLabelQuery(compiled.gmail, labelNames);
    }
    const countMode = Boolean(compiled?.count);
    // Counting lists ids only (cheap, 500 per page) up to a cap. Thread-aware questions scan deeper because threads collapse.
    const scan = countMode ? 5000 : compiled?.threadAware ? Math.min(limit * 2, 160) : limit;
    const allIds = await gmail.listMessageIds(gmailQuery, scan);
    const ids = allIds.slice(0, countMode ? Math.min(limit, 80) : scan);
    const metas = (await mapLimit(ids, 8, (id) => gmail.getMessageMeta(id).catch(() => null))).filter((m): m is NonNullable<typeof m> => Boolean(m));

    let rows = groupThreads(metas);
    const threadsFound = rows.length;
    if (compiled?.threadAware) await addThreadContext(gmail, rows, email);
    // Who spoke last is a fact, not a judgment: apply it before asking Jev anything.
    let excluded = 0;
    if (compiled) {
      const before = rows.length;
      if (compiled.intents.waiting) rows = rows.filter((r) => r.lastFromMe !== false);
      else if (compiled.intents.neverAnswered) rows = rows.filter((r) => !r.anyFromMe);
      else if (compiled.intents.needsReply) rows = rows.filter((r) => r.lastFromMe !== true);
      excluded = before - rows.length;
    }
    rows = rows.slice(0, limit);

    let inputTokens = compiled?.usage.inputTokens ?? 0;
    let requests = compiled ? 1 : 0;
    let model = compiled?.model;
    let signals = new Map<string, Signals>();
    if (compiled && body.rerank !== false && !countMode) {
      const r = await rerankThreads(compiled, rows, email);
      signals = r.signals; inputTokens += r.inputTokens; requests += r.requests; model = r.model ?? model;
    }

    const domainOf = (from: string) => (from.match(/@([^>\s]+)/)?.[1] ?? from).toLowerCase();
    const bySender = new Map<string, number>();
    const byLabel = new Map<string, number>();
    let unread = 0;
    for (const m of metas) {
      if (m.labelIds.includes("UNREAD")) unread++;
      const d = domainOf(m.headers["from"] ?? "");
      bySender.set(d, (bySender.get(d) ?? 0) + 1);
      for (const l of m.labelIds) { if (!l.startsWith("CATEGORY_") && !["UNREAD", "INBOX", "IMPORTANT", "STARRED", "SENT"].includes(l)) { const n = idToLabel.get(l) ?? l; byLabel.set(n, (byLabel.get(n) ?? 0) + 1); } }
    }
    const primary = primarySignal(compiled);
    const values = primary ? rows.map((r) => signals.get(r.threadId)?.[primary]).filter((v): v is number => v !== undefined) : [];
    const distribution = primary && values.length ? { signal: primary, likely: values.filter((v) => v >= 0.7).length, unsure: values.filter((v) => v >= 0.4 && v < 0.7).length, unlikely: values.filter((v) => v < 0.4).length } : null;
    const numbers = {
      total: allIds.length, capped: allIds.length >= 5000, sampled: metas.length, threads: threadsFound, unread,
      senders: [...bySender.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([domain, count]) => ({ domain, count })),
      labels: [...byLabel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count })),
    };

    let results = rows.map((r) => {
      const m = r.latest;
      return {
        threadId: r.threadId, ids: r.messageIds, matched: r.matched, total: r.total ?? null, lastFromMe: r.lastFromMe ?? null, participants: r.participants,
        from: m.headers["from"] ?? "", subject: m.headers["subject"] ?? "(no subject)", date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
        snippet: m.snippet, unread: r.unread, latestUnread: m.labelIds.includes("UNREAD"), starred: m.labelIds.includes("STARRED"), inInbox: m.labelIds.includes("INBOX"),
        labels: m.labelIds.filter((l) => !l.startsWith("CATEGORY_") && !["UNREAD", "INBOX", "IMPORTANT", "STARRED", "SENT"].includes(l)).map((l) => idToLabel.get(l) ?? l),
        signals: signals.get(r.threadId) ?? null,
      };
    });
    let dropped = 0;
    if (compiled && signals.size) {
      // Something owed that you have not even opened comes first.
      const owed = compiled.rerank.needsReply || compiled.rerank.urgency;
      const rank = (r: (typeof results)[number]) => scoreOf(compiled!, r.signals ?? undefined) + (owed && r.latestUnread ? 0.15 : 0);
      results.sort((a, b) => rank(b) - rank(a) || (b.date ?? "").localeCompare(a.date ?? ""));
      // Drop what a strong negative rules out for the signal the question was about.
      const kept = results.filter((r) => {
        const s = r.signals;
        if (!s) return true;
        if (compiled!.rerank.human && s.human !== undefined && s.human < 0.3) return false;
        if (compiled!.rerank.relevance && s.relevance !== undefined && s.relevance < 0.2) return false;
        if (compiled!.rerank.needsReply && s.needsReply !== undefined && s.needsReply < 0.12) return false;
        if (compiled!.rerank.waiting && s.waiting !== undefined && s.waiting < 0.12) return false;
        return true;
      });
      dropped = results.length - kept.length;
      results = kept;
    }
    const readState = { unseen: results.filter((r) => r.latestUnread).length, seen: results.filter((r) => !r.latestUnread).length };
    return NextResponse.json({ compiled, gmail: gmailQuery, total: allIds.length, numbers, distribution, readState, primary, results, dropped, excluded, cost: { inputTokens, requests, usd: inputTokens * USD_PER_INPUT_TOKEN }, model: model ?? null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
