import { noul, score } from "@typesafe-ai/sdk";
import { jev } from "@/lib/ai/client";
import { mapLimit } from "@/lib/gmail/client";
import type { CompiledQuery } from "./compile";
import type { ThreadRow } from "./threads";

/** Per-thread probabilities, each 0..1. Only the ones the query asked for are filled. */
export type Signals = { relevance?: number; needsReply?: number; human?: number; disposable?: number; urgency?: number; waiting?: number };

const RELEVANCE_LEVELS = [
  "Unrelated to the search.",
  "Adjacent: shares a sender, a word, or a theme with the search but is about something else.",
  "About the searched subject.",
  "Exactly what the user is looking for.",
] as const;

const daysBetween = (a: string | number, b: Date) => Math.max(0, Math.round((b.getTime() - Number(a)) / 86400_000));

/** One request per thread with the thread's reply state in the state, so "needs reply" is judged on the conversation, not one message. */
export async function rerankThreads(query: CompiledQuery, rows: ThreadRow[], userEmail: string, now = new Date()): Promise<{ signals: Map<string, Signals>; inputTokens: number; requests: number; model?: string }> {
  const want = query.rerank;
  const signals = new Map<string, Signals>();
  let inputTokens = 0, requests = 0, model: string | undefined;
  if (!want.relevance && !want.needsReply && !want.human && !want.disposable && !want.urgency && !want.waiting) return { signals, inputTokens, requests };
  const questions = {
    ...(want.relevance ? { relevance: score({ question: "How well does this email match what the user is searching for, given in `search`?", note: "Judge the subject matter, not the sender's importance." }, RELEVANCE_LEVELS) } : {}),
    ...(want.needsReply ? { needs_reply: noul({ question: "Does the recipient still owe the other party a reply or an action in this conversation?", note: "`thread.last_message_from` says who spoke last and `thread.recipient_replied_after` whether the recipient already answered. `latest_message.recipient_has_read_it` false means the recipient has not even seen it yet. A courtesy close such as 'thanks, noted' asks for nothing." }, { true: "The other party is waiting on the recipient to answer, decide, schedule, or send something.", false: "Nothing is owed: already answered, purely informational, or a closing courtesy." }) } : {}),
    ...(want.waiting ? { waiting: noul({ question: "Is the recipient waiting for the other party to respond to the recipient's last message?", note: "The recipient wrote the latest message in this thread." }, { true: "The recipient asked a question or made a request that has had no answer.", false: "The recipient's message closed the conversation or needs no answer." }) } : {}),
    ...(want.human ? { human: noul("Was this written by a person for this recipient rather than generated in bulk?", { true: "A human wrote it.", false: "Automated, campaign, or notification." }) } : {}),
    ...(want.disposable ? { disposable: noul("Once seen, would nothing be lost by trashing this email?", { true: "Disposable.", false: "A record, receipt, ticket, or personal message worth keeping." }) } : {}),
    ...(want.urgency ? { urgency: noul("Does this need attention within the next few days?", { true: "A deadline, event date, expiring offer, delivery window, or an explicit ask for a quick answer.", false: "No time pressure; equally useful next month." }) } : {}),
  };
  await mapLimit(rows, 8, async (row) => {
    const m = row.latest;
    try {
      const res = await jev().systemOne({
        state: {
          recipient: userEmail,
          search: query.input,
          latest_message: { from: m.headers["from"] ?? "", to: m.headers["to"] ?? "", subject: m.headers["subject"] ?? "", date: m.headers["date"] ?? "", preview: m.snippet.slice(0, 500), is_reply: Boolean(m.headers["in-reply-to"]) || /^\s*re:/i.test(m.headers["subject"] ?? ""), recipient_has_read_it: !m.labelIds.includes("UNREAD"), starred: m.labelIds.includes("STARRED") },
          thread: {
            messages: row.total ?? row.matched,
            last_message_from: row.lastFromMe === undefined ? "unknown" : row.lastFromMe ? "recipient" : "other party",
            recipient_replied_after: row.repliedAfterLatest ?? null,
            days_since_latest: daysBetween(m.internalDate, now),
          },
          bulk_headers: { has_list_unsubscribe: Boolean(m.headers["list-unsubscribe"]), precedence: m.headers["precedence"] ?? null, auto_submitted: m.headers["auto-submitted"] ?? null },
        },
        questions,
      });
      const ans = res.answers as Record<string, { noul?: number; score?: number }>;
      signals.set(row.threadId, {
        relevance: ans.relevance?.score !== undefined ? ans.relevance.score / (RELEVANCE_LEVELS.length - 1) : undefined,
        needsReply: ans.needs_reply?.noul, waiting: ans.waiting?.noul, human: ans.human?.noul, disposable: ans.disposable?.noul, urgency: ans.urgency?.noul,
      });
      inputTokens += res.usage.input_tokens; requests++; model = res.model;
    } catch { /* leave unranked */ }
  });
  return { signals, inputTokens, requests, model };
}

/** The ranking score: the signals the query asked for, summed. */
export function scoreOf(q: CompiledQuery, s: Signals | undefined): number {
  if (!s) return 0;
  let total = 0;
  if (q.rerank.relevance && s.relevance !== undefined) total += s.relevance * 1.5;
  if (q.rerank.needsReply && s.needsReply !== undefined) total += s.needsReply;
  if (q.rerank.waiting && s.waiting !== undefined) total += s.waiting;
  if (q.rerank.human && s.human !== undefined) total += s.human * 0.5;
  if (q.rerank.disposable && s.disposable !== undefined) total += s.disposable;
  if (q.rerank.urgency && s.urgency !== undefined) total += s.urgency;
  return total;
}
