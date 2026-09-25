/**
 * Sender intelligence: aggregate the last N days of mail by sender domain, judge each sender once with
 * TypeSafe, and turn probabilities plus the user's own reading behavior into a recommendation.
 */
import { and, eq, sql } from "drizzle-orm";
import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { db, schema } from "@/db";
import { CATEGORIES, type CategoryId, type PolicyConfig } from "@/lib/policy/schema";
import { mapLimit, type GmailClient } from "@/lib/gmail/client";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";
import type { SenderDecision, SenderJudgment } from "@/db/schema";

let client: TypeSafeClient | null = null;
const ts = () => (client ??= new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY }));

type Agg = { domain: string; names: Map<string, number>; messages: number; unread: number; inInbox: number; olderThan30: number; first: number; last: number; subjects: string[]; listUnsubscribe?: string };

export function domainOf(from: string): { domain: string; name: string } {
  const email = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? email.toLowerCase();
  const name = from.replace(/<[^>]+>/, "").replace(/["']/g, "").trim();
  return { domain, name };
}

export async function scanSenders(opts: { gmail: GmailClient; userId: string; days?: number; maxMessages?: number; judge?: boolean; budgetUsd?: number }) {
  const { gmail, userId } = opts;
  const days = opts.days ?? 90;
  const ids = await gmail.listMessageIds(`newer_than:${days}d -from:me -in:trash -in:spam -in:draft`, opts.maxMessages ?? 1500);
  const metas = await mapLimit(ids, 10, (id) => gmail.getMessageMeta(id, ["From", "Subject", "Date", "List-Unsubscribe"]).catch(() => null));
  const agg = new Map<string, Agg>();
  const cutoff30 = Date.now() - 30 * 86400_000;
  for (const m of metas) {
    if (!m) continue;
    const { domain, name } = domainOf(m.headers["from"] ?? "");
    if (!domain) continue;
    const a: Agg = agg.get(domain) ?? { domain, names: new Map<string, number>(), messages: 0, unread: 0, inInbox: 0, olderThan30: 0, first: Infinity, last: 0, subjects: [] as string[] };
    a.messages++;
    if (m.labelIds.includes("UNREAD")) a.unread++;
    if (m.labelIds.includes("INBOX")) a.inInbox++;
    const t = Number(m.internalDate);
    if (t < cutoff30) a.olderThan30++;
    a.first = Math.min(a.first, t); a.last = Math.max(a.last, t);
    if (name) a.names.set(name, (a.names.get(name) ?? 0) + 1);
    const subj = m.headers["subject"];
    if (subj && a.subjects.length < 5 && !a.subjects.includes(subj)) a.subjects.push(subj);
    if (m.headers["list-unsubscribe"] && !a.listUnsubscribe) a.listUnsubscribe = m.headers["list-unsubscribe"].slice(0, 500);
    agg.set(domain, a);
  }
  const rows = [...agg.values()].sort((x, y) => y.messages - x.messages);
  for (const a of rows) {
    const displayName = [...a.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    await db.insert(schema.senderProfiles).values({
      userId, domain: a.domain, displayName, messages: a.messages, unread: a.unread, inInbox: a.inInbox,
      firstSeenAt: new Date(a.first), lastSeenAt: new Date(a.last), sampleSubjects: a.subjects, listUnsubscribe: a.listUnsubscribe ?? null, scannedAt: new Date(), updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [schema.senderProfiles.userId, schema.senderProfiles.domain],
      set: { displayName, messages: a.messages, unread: a.unread, inInbox: a.inInbox, firstSeenAt: new Date(a.first), lastSeenAt: new Date(a.last), sampleSubjects: a.subjects, listUnsubscribe: a.listUnsubscribe ?? null, scannedAt: new Date(), updatedAt: new Date() },
    });
  }
  let judged = 0, inputTokens = 0;
  if (opts.judge !== false && process.env.TYPESAFE_API_KEY) {
    const existing = await db.select({ domain: schema.senderProfiles.domain, judgment: schema.senderProfiles.judgment }).from(schema.senderProfiles).where(eq(schema.senderProfiles.userId, userId));
    const has = new Set(existing.filter((e) => e.judgment).map((e) => e.domain));
    const budget = Math.floor((opts.budgetUsd ?? 0.5) / (900 * USD_PER_INPUT_TOKEN));
    const toJudge = rows.filter((a) => !has.has(a.domain) && a.messages >= 2).slice(0, Math.min(400, budget));
    await mapLimit(toJudge, 6, async (a) => {
      try {
        const j = await judgeSender(a);
        await db.update(schema.senderProfiles).set({ judgment: j, updatedAt: new Date() }).where(and(eq(schema.senderProfiles.userId, userId), eq(schema.senderProfiles.domain, a.domain)));
        judged++; inputTokens += j.inputTokens ?? 0;
      } catch { /* skip */ }
    });
  }
  return { messagesScanned: metas.filter(Boolean).length, senders: rows.length, judged, inputTokens, estimatedCostUsd: inputTokens * USD_PER_INPUT_TOKEN };
}

const categoryCriteria = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.description])) as Record<CategoryId, string>;

async function judgeSender(a: Agg): Promise<SenderJudgment> {
  const displayName = [...a.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  const state = {
    sender: { domain: a.domain, display_name: displayName, has_list_unsubscribe: Boolean(a.listUnsubscribe) },
    volume: { messages_last_90_days: a.messages, unread_ratio: Number((a.unread / a.messages).toFixed(2)), still_in_inbox: a.inInbox, first_seen: new Date(a.first).toISOString().slice(0, 10), last_seen: new Date(a.last).toISOString().slice(0, 10) },
    sample_subjects: a.subjects,
  };
  const res = await ts().systemOne({
    state,
    questions: {
      category: choice("Which mailbox category does mail from this sender belong to?", categoryCriteria),
      safe_to_trash_old: noul({ question: "Would the recipient lose nothing of value if every message from this sender older than one month were moved to Trash?", note: "Consider whether messages are records anyone searches for later. Unread ratio and subjects are evidence of how the recipient treats this sender." }, { true: "Disposable after a month: promotions, digests, notifications, expired codes.", false: "Receipts, statements, tickets, personal or work mail, anything referenced later." }),
      transactional: noul("Are these messages records of transactions or accounts: receipts, orders, statements, confirmations, tickets?", { true: "Records worth keeping.", false: "Not records." }),
      human: noul("Are these messages written by a person to the recipient rather than sent by a system or campaign?", { true: "A human writes them.", false: "Automated or bulk." }),
    },
  });
  return {
    category: res.answers.category.choice, categoryConfidence: res.answers.category.confidence,
    safeToTrashOld: res.answers.safe_to_trash_old.noul, transactional: res.answers.transactional.noul, human: res.answers.human.noul,
    model: res.model, inputTokens: res.usage.input_tokens,
  };
}

export type Recommendation = "protect" | "trash-old" | "trash-all" | "keep";

export function recommend(p: { messages: number; unread: number; judgment: SenderJudgment | null; decision: SenderDecision; domain: string }, policy: PolicyConfig): { rec: Recommendation; reason: string } {
  if (p.decision === "protect" || p.decision === "work" || p.decision === "family") return { rec: "protect", reason: "your decision" };
  if (p.decision === "trash-old") return { rec: "trash-old", reason: "your decision" };
  if (p.decision === "trash-all") return { rec: "trash-all", reason: "your decision" };
  if (policy.senders.protected.includes(p.domain) || policy.senders.work.includes(p.domain) || policy.senders.family.includes(p.domain)) return { rec: "protect", reason: "listed in your policy" };
  const j = p.judgment;
  if (!j) return { rec: "keep", reason: "not judged yet" };
  const unreadRatio = p.messages ? p.unread / p.messages : 0;
  if (j.human >= 0.6) return { rec: "protect", reason: `a person writes these (${Math.round(j.human * 100)}%)` };
  if (j.transactional >= 0.6) return { rec: "protect", reason: `records worth keeping (${Math.round(j.transactional * 100)}%)` };
  if (policy.categories.protected.includes(j.category as CategoryId)) return { rec: "protect", reason: `${j.category} is a protected category` };
  if (j.safeToTrashOld >= 0.9 && unreadRatio >= 0.9 && p.messages >= 5) return { rec: "trash-all", reason: `you never open these (${Math.round(unreadRatio * 100)}% unread), disposable ${Math.round(j.safeToTrashOld * 100)}%` };
  if (j.safeToTrashOld >= 0.75 && p.messages >= 3) return { rec: "trash-old", reason: `disposable after a month (${Math.round(j.safeToTrashOld * 100)}%), ${Math.round(unreadRatio * 100)}% unread` };
  return { rec: "keep", reason: `keep value unclear (disposable ${Math.round(j.safeToTrashOld * 100)}%)` };
}

export async function senderOverview(userId: string, policy: PolicyConfig) {
  const rows = await db.select().from(schema.senderProfiles).where(eq(schema.senderProfiles.userId, userId)).orderBy(sql`${schema.senderProfiles.messages} desc`);
  return rows.map((r) => ({ ...r, recommendation: recommend({ messages: r.messages, unread: r.unread, judgment: r.judgment ?? null, decision: r.decision ?? null, domain: r.domain }, policy) }));
}
