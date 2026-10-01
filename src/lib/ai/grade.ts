/**
 * Grading: a second, narrower look at what a run did to one email. Jev is asked three things about the email and
 * the rule that acted on it, and code turns the probabilities into agree / unsure / disagree. Metadata only.
 */
import { noul } from "@typesafe-ai/sdk";
import { jev } from "@/lib/ai/client";
import type { GmailMessageMeta } from "@/lib/gmail/client";

export type RuleKind = "trash" | "archive" | "label";
export type RuleIntent = { id: string; kind: RuleKind; intent: string };
export type Verdict = "agree" | "unsure" | "disagree";
export type Grade = { verdict: Verdict; actionOk: number; belongs: number; worthKeeping: number; why: string };

/** The grader's model. Jev is TypeSafe's only model today; this is where a faster one goes when there is one. */
export const GRADER_MODEL = process.env.TYPESAFE_GRADER_MODEL || "jev-latest";

export const GRADE_QUESTIONS = {
  belongs: noul(
    { question: "Is this email genuinely the kind of mail the rule in `rule` targets, judged from the sender, subject, preview, and labels, rather than something mislabeled?", note: "Labels can be wrong: a Gmail filter or an earlier judgment may have put this email in the wrong place." },
    { true: "Clearly the kind of mail the rule is about.", false: "Mislabeled, or a different kind of mail wearing that label." },
  ),
  worth_keeping: noul(
    "Would the recipient plausibly want this email later: a record, receipt, statement, ticket, confirmation, personal message, something still to act on, or anything they might search for?",
    { true: "Worth keeping, or still useful.", false: "Nothing would be lost: a notification, digest, promotion, duplicate, or expired alert." },
  ),
  action_ok: noul(
    { question: "Given `rule` and this email, was taking the rule's action on this email the right call?", note: "Trash keeps mail for 30 days and nothing is deleted for good. Archive only leaves the inbox. Judge whether a careful assistant would have done the same." },
    { true: "The right call for this email.", false: "A mistake: this email should not have been handled this way." },
  ),
} as const;

const pct = (p: number) => `${Math.round(p * 100)}%`;

export async function gradeAction(meta: GmailMessageMeta, rule: RuleIntent, userEmail: string, labelNames: string[]): Promise<Grade & { inputTokens: number; model: string }> {
  const h = meta.headers;
  const ageDays = meta.internalDate ? Math.max(0, Math.round((Date.now() - Number(meta.internalDate)) / 86400_000)) : null;
  const res = await jev().systemOne({
    model: GRADER_MODEL,
    state: {
      recipient: userEmail,
      rule,
      email: {
        from: h["from"] ?? "", subject: h["subject"] ?? "", date: h["date"] ?? "", age_days: ageDays,
        preview: meta.snippet.slice(0, 500),
        labels: labelNames,
        gmail_tab: meta.labelIds.find((l) => l.startsWith("CATEGORY_"))?.replace("CATEGORY_", "").toLowerCase() ?? null,
        was_unread: meta.labelIds.includes("UNREAD"),
        bulk_headers: { has_list_unsubscribe: Boolean(h["list-unsubscribe"]), precedence: h["precedence"] ?? null, auto_submitted: h["auto-submitted"] ?? null },
      },
    },
    questions: GRADE_QUESTIONS,
  });
  const actionOk = res.answers.action_ok.noul, belongs = res.answers.belongs.noul, worthKeeping = res.answers.worth_keeping.noul;
  // The gate is the two crisp facts. "Was it the right call" is a hedge-prone composite, so it only breaks ties.
  const verdict: Verdict =
    worthKeeping >= 0.6 || belongs <= 0.35 || actionOk <= 0.3 ? "disagree"
    : worthKeeping <= 0.4 && belongs >= 0.6 ? "agree"
    : actionOk >= 0.6 && worthKeeping < 0.5 ? "agree"
    : "unsure";
  const verb = rule.kind === "trash" ? "trashed" : rule.kind === "archive" ? "archived" : "labeled";
  const why =
    worthKeeping >= 0.6 ? `Looks worth keeping (${pct(worthKeeping)})`
    : belongs <= 0.35 ? `Does not look like what the rule targets (${pct(belongs)})`
    : actionOk <= 0.3 ? `Jev would not have ${verb} it (${pct(actionOk)})`
    : verdict === "agree" ? `Fits the rule (${pct(belongs)}), nothing to keep (${pct(worthKeeping)})`
    : `Mixed: fits the rule ${pct(belongs)}, worth keeping ${pct(worthKeeping)}`;
  return { verdict, actionOk, belongs, worthKeeping, why, inputTokens: res.usage.input_tokens, model: res.model };
}

/** What a batch did, in words the grader can weigh. */
export function describeBatch(ruleId: string, query: string | undefined, addLabelIds: string[], removeLabelIds: string[], names: (id: string) => string): RuleIntent {
  const q = query ? ` matching the Gmail query ${query}` : "";
  if (addLabelIds.includes("TRASH")) return { id: ruleId, kind: "trash", intent: `Rule "${ruleId}" moves mail${q} to Trash. Trash keeps it 30 days.` };
  if (removeLabelIds.includes("INBOX") && !addLabelIds.length) return { id: ruleId, kind: "archive", intent: `Rule "${ruleId}" archives mail${q}: it leaves the inbox but stays in All Mail.` };
  const added = addLabelIds.map(names).join(", ");
  const left = removeLabelIds.includes("INBOX") ? " and takes it out of the inbox" : "";
  return { id: ruleId, kind: "label", intent: ruleId === "ai-triage" ? `Jev's triage labeled this email ${added}${left}.` : `Rule "${ruleId}" labels mail${q} ${added}${left}.` };
}
