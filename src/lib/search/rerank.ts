import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import type { GmailMessageMeta } from "@/lib/gmail/client";
import { mapLimit } from "@/lib/gmail/client";
import type { CompiledQuery } from "./compile";

let client: TypeSafeClient | null = null;
const ts = () => (client ??= new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY }));

export type Ranked = { id: string; relevance?: number; needsReply?: number; human?: number; disposable?: number };

/** One small request per result, only for the signals the compiled query asked for. */
export async function rerank(query: CompiledQuery, metas: GmailMessageMeta[], userEmail: string): Promise<{ ranked: Map<string, Ranked>; inputTokens: number; requests: number }> {
  const want = query.rerank;
  const ranked = new Map<string, Ranked>();
  let inputTokens = 0, requests = 0;
  if (!want.relevance && !want.needsReply && !want.human && !want.disposable) return { ranked, inputTokens, requests };
  const questions = {
    ...(want.relevance ? { relevance: noul({ question: "Is this email about what the user is searching for in `search`?", search: query.input }, { true: "Directly about the searched topic.", false: "Unrelated or only superficially similar." }) } : {}),
    ...(want.needsReply ? { needs_reply: noul("Does the recipient still owe this sender a reply or action?", { true: "A person or process is waiting on the recipient.", false: "Nothing is owed." }) } : {}),
    ...(want.human ? { human: noul("Was this written by a person for this recipient rather than generated in bulk?", { true: "A human wrote it.", false: "Automated, campaign, or notification." }) } : {}),
    ...(want.disposable ? { disposable: noul("Once seen, would nothing be lost by trashing this email?", { true: "Disposable.", false: "A record, receipt, ticket, or personal message worth keeping." }) } : {}),
  };
  await mapLimit(metas, 8, async (m) => {
    try {
      const res = await ts().systemOne({ state: { recipient: userEmail, from: m.headers["from"] ?? "", subject: m.headers["subject"] ?? "", date: m.headers["date"] ?? "", preview: m.snippet.slice(0, 500), has_list_unsubscribe: Boolean(m.headers["list-unsubscribe"]) }, questions });
      const ans = res.answers as Record<string, { noul?: number }>;
      ranked.set(m.id, { id: m.id, relevance: ans.relevance?.noul, needsReply: ans.needs_reply?.noul, human: ans.human?.noul, disposable: ans.disposable?.noul });
      inputTokens += res.usage.input_tokens; requests++;
    } catch { /* leave unranked */ }
  });
  return { ranked, inputTokens, requests };
}

export function scoreOf(q: CompiledQuery, r: Ranked | undefined): number {
  if (!r) return 0;
  let s = 0;
  if (q.rerank.relevance && r.relevance !== undefined) s += r.relevance;
  if (q.rerank.needsReply && r.needsReply !== undefined) s += r.needsReply;
  if (q.rerank.human && r.human !== undefined) s += r.human;
  if (q.rerank.disposable && r.disposable !== undefined) s += r.disposable;
  return s;
}
