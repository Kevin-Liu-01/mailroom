import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { gmailFor } from "@/lib/engine/run";
import { mapLimit } from "@/lib/gmail/client";
import { compileSearch } from "@/lib/search/compile";
import { rerank, scoreOf, type Ranked } from "@/lib/search/rerank";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";

export const maxDuration = 120;

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { q?: string; gmail?: string; limit?: number; rerank?: boolean };
  const limit = Math.min(Math.max(body.limit ?? 40, 1), 100);
  try {
    const { gmail, email } = await gmailFor(userId);
    const known = await db.select({ domain: schema.senderProfiles.domain, name: schema.senderProfiles.displayName }).from(schema.senderProfiles).where(eq(schema.senderProfiles.userId, userId));
    const labelNames = new Set((await gmail.listLabels()).map((l) => l.name));
    let compiled = null;
    let gmailQuery = body.gmail?.trim();
    if (!gmailQuery) {
      if (!body.q?.trim()) return NextResponse.json({ error: "empty query" }, { status: 400 });
      compiled = await compileSearch(body.q, { knownSenders: known, hasLabel: (n) => labelNames.has(n) });
      gmailQuery = compiled.gmail;
    }
    const ids = await gmail.listMessageIds(gmailQuery, limit);
    const metas = (await mapLimit(ids, 8, (id) => gmail.getMessageMeta(id).catch(() => null))).filter((m): m is NonNullable<typeof m> => Boolean(m));
    let inputTokens = compiled?.usage.inputTokens ?? 0;
    let ranked = new Map<string, Ranked>();
    if (compiled && body.rerank !== false) {
      const r = await rerank(compiled, metas, email);
      ranked = r.ranked; inputTokens += r.inputTokens;
    }
    const idToLabel = new Map((await gmail.listLabels()).map((l) => [l.id, l.name]));
    const results = metas.map((m) => ({
      id: m.id, threadId: m.threadId,
      from: m.headers["from"] ?? "", subject: m.headers["subject"] ?? "(no subject)", date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
      snippet: m.snippet, unread: m.labelIds.includes("UNREAD"), starred: m.labelIds.includes("STARRED"), inInbox: m.labelIds.includes("INBOX"),
      labels: m.labelIds.filter((l) => !l.startsWith("CATEGORY_") && !["UNREAD", "INBOX", "IMPORTANT", "STARRED", "SENT"].includes(l)).map((l) => idToLabel.get(l) ?? l),
      signals: ranked.get(m.id) ?? null,
    }));
    if (compiled) {
      results.sort((a, b) => scoreOf(compiled!, ranked.get(b.id)) - scoreOf(compiled!, ranked.get(a.id)) || (b.date ?? "").localeCompare(a.date ?? ""));
      // Drop results a strong negative signal rules out when the query asked for that signal.
      const filtered = results.filter((r) => {
        const s = r.signals;
        if (!s) return true;
        if (compiled!.rerank.human && s.human !== undefined && s.human < 0.3) return false;
        if (compiled!.rerank.relevance && s.relevance !== undefined && s.relevance < 0.2) return false;
        return true;
      });
      return NextResponse.json({ compiled, gmail: gmailQuery, total: ids.length, results: filtered, dropped: results.length - filtered.length, cost: { inputTokens, usd: inputTokens * USD_PER_INPUT_TOKEN } });
    }
    return NextResponse.json({ compiled: null, gmail: gmailQuery, total: ids.length, results, dropped: 0, cost: { inputTokens: 0, usd: 0 } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
