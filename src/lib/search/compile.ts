/**
 * Natural language -> Gmail query. Code finds the candidates (senders, dates, flags, phrases);
 * TypeSafe selects among them and answers a few yes/no questions; code assembles the query.
 */
import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { CATEGORIES, LABEL_BY_CATEGORY, type CategoryId } from "@/lib/policy/schema";
import { FLAG_WORDS, MONTHS, STOPWORDS, TIME_WINDOWS, type TimeWindow } from "./lexicon";

export type KnownSender = { domain: string; name?: string | null };
export type QueryPart = { kind: "category" | "sender" | "time" | "flag" | "topic" | "note"; label: string; value: string; source: "rule" | "ai" };
export type CompiledQuery = {
  input: string;
  gmail: string;
  parts: QueryPart[];
  category: CategoryId | "any";
  timeWindow: TimeWindow | "explicit";
  senders: string[];
  flags: string[];
  topic: string;
  /** The user asked how many, not which. */
  count: boolean;
  /** Rerank hints for the result stage. */
  rerank: { relevance: boolean; needsReply: boolean; human: boolean; disposable: boolean };
  usage: { inputTokens: number; requests: number };
  model?: string;
};

let client: TypeSafeClient | null = null;
const ts = () => (client ??= new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY }));

const fmt = (d: Date) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;

export function timeToGmail(window: TimeWindow, now: Date): string {
  const y = now.getUTCFullYear();
  switch (window) {
    case "today": return "newer_than:1d";
    case "yesterday": { const d = new Date(now); d.setUTCDate(d.getUTCDate() - 1); const e = new Date(now); return `after:${fmt(d)} before:${fmt(e)}`; }
    case "this_week": return "newer_than:7d";
    case "last_2_weeks": return "newer_than:14d";
    case "last_30_days": return "newer_than:30d";
    case "last_90_days": return "newer_than:90d";
    case "last_6_months": return "newer_than:180d";
    case "this_year": return `after:${y}/01/01`;
    case "last_year": return `after:${y - 1}/01/01 before:${y}/01/01`;
    case "older_than_1_year": return "older_than:1y";
    case "older_than_6_months": return "older_than:6m";
    case "older_than_30_days": return "older_than:30d";
    default: return "";
  }
}

/** Explicit month names and years become exact after/before ranges without asking the model. */
export function explicitDateRange(q: string, now: Date): { gmail: string; label: string } | null {
  const lower = q.toLowerCase();
  const year = lower.match(/\b(20\d{2})\b/)?.[1];
  const monthIdx = MONTHS.findIndex((m) => new RegExp(`\\b${m.slice(0, 3)}[a-z]*\\b`).test(lower));
  if (monthIdx >= 0) {
    const y = year ? Number(year) : monthIdx > now.getUTCMonth() ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const start = new Date(Date.UTC(y, monthIdx, 1));
    const end = new Date(Date.UTC(y, monthIdx + 1, 1));
    return { gmail: `after:${fmt(start)} before:${fmt(end)}`, label: `${MONTHS[monthIdx][0].toUpperCase()}${MONTHS[monthIdx].slice(1)} ${y}` };
  }
  if (year && !/last year|this year/.test(lower)) {
    return { gmail: `after:${year}/01/01 before:${Number(year) + 1}/01/01`, label: year };
  }
  const rel = lower.match(/\b(?:last|past|previous)\s+(\d{1,3})\s*(day|week|month|year)s?\b/);
  if (rel) {
    const n = Number(rel[1]); const unit = rel[2];
    const days = unit === "day" ? n : unit === "week" ? n * 7 : unit === "month" ? n * 30 : n * 365;
    return { gmail: `newer_than:${days}d`, label: `last ${n} ${unit}${n > 1 ? "s" : ""}` };
  }
  return null;
}

function tokens(q: string): string[] {
  return q.toLowerCase().replace(/[^a-z0-9@.\-'\s]/g, " ").split(/\s+/).filter(Boolean);
}

export function senderCandidates(q: string, known: KnownSender[]): KnownSender[] {
  const out = new Map<string, KnownSender>();
  for (const m of q.matchAll(/[\w.+-]+@([\w-]+\.[\w.-]+)/g)) out.set(m[0].toLowerCase(), { domain: m[0].toLowerCase() });
  for (const m of q.matchAll(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|dev|ai|co|app|edu|gov|us|uk|ca|me|so|xyz))\b/gi)) out.set(m[1].toLowerCase(), { domain: m[1].toLowerCase() });
  const words = tokens(q).filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !MONTHS.some((m) => m.startsWith(w)));
  for (const k of known) {
    const hay = `${k.domain} ${k.name ?? ""}`.toLowerCase();
    if (words.some((w) => hay.includes(w))) out.set(k.domain, k);
    if (out.size >= 12) break;
  }
  return [...out.values()];
}

export function detectFlags(q: string): string[] {
  return Object.entries(FLAG_WORDS).filter(([, re]) => re.test(q)).map(([k]) => k);
}

export function residualTopic(q: string, senders: KnownSender[], flags: string[]): string {
  let text = q.toLowerCase();
  const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const s of senders) {
    text = text.replace(new RegExp(esc(s.domain), "g"), " ");
    for (const part of s.domain.split(/[@.]/)) if (part.length >= 3 && !["com", "org", "net", "mail", "email", "news", "info"].includes(part)) text = text.replace(new RegExp(`\\b${esc(part)}\\b`, "g"), " ");
    for (const w of (s.name ?? "").toLowerCase().split(/\s+/)) if (w.length >= 3) text = text.replace(new RegExp(`\\b${esc(w)}\\b`, "g"), " ");
  }
  for (const f of flags) text = text.replace(FLAG_WORDS[f], " ");
  text = text.replace(/\b(last|past|previous|this|next)\s+(\d+\s*)?(day|week|month|year|quarter)s?\b/g, " ").replace(/\b(today|yesterday|recent|recently|old|older|newer|ago)\b/g, " ").replace(/\b20\d{2}\b/g, " ");
  for (const m of MONTHS) text = text.replace(new RegExp(`\\b${m.slice(0, 3)}[a-z]*\\b`, "g"), " ");
  const catWords = new Set(CATEGORIES.flatMap((c) => (c.label ?? "").toLowerCase().split(/[\s&]+/)).concat(["receipt", "receipts", "promo", "promos", "promotion", "promotions", "newsletter", "newsletters", "recruiter", "recruiters", "recruiting", "job", "jobs", "security", "code", "codes", "bank", "banking", "finance", "travel", "trip", "trips", "flight", "flights", "event", "events", "invite", "invites", "invitation", "invitations", "social", "notification", "notifications", "dev", "github", "deploy", "deploys", "work", "personal", "school", "marketing", "deals", "sale", "sales", "order", "orders", "shipping", "delivery", "statement", "statements"]));
  const words = tokens(text).filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !catWords.has(w));
  return [...new Set(words)].slice(0, 6).join(" ");
}

const categoryCriteria = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label ? `${c.label}: ${c.description}` : "The query names no category (use `any` instead of this)."])),
  any: "The query does not restrict to one category of mail.",
} as Record<string, string>;

export async function compileSearch(input: string, ctx: { now?: Date; knownSenders?: KnownSender[]; hasLabel?: (name: string) => boolean }): Promise<CompiledQuery> {
  const now = ctx.now ?? new Date();
  const q = input.trim();
  const flags = detectFlags(q);
  const senders = senderCandidates(q, ctx.knownSenders ?? []);
  const explicit = explicitDateRange(q, now);
  const topic = residualTopic(q, senders, flags);
  const parts: QueryPart[] = [];
  const clauses: string[] = [];

  const questions = {
    category: choice({ question: "Which mailbox category does the search ask for? Choose `any` when the query names none.", note: "Receipts covers orders, rides, food delivery, shipping. Recruiting covers job outreach. Accounts & Security covers codes and sign-in alerts." }, categoryCriteria),
    time_window: choice({ question: "Which time window does the query ask for? Choose `any` unless the query itself mentions a time such as today, this week, last month, or a year.", note: "`current_date` is only context for resolving relative words; it is not evidence that the user asked about today." }, TIME_WINDOWS as unknown as Record<string, string>),
    ...(senders.length ? {
      sender: choice({ question: "Which candidate sender, if any, does the query refer to? Candidates were found by matching words of the query against known senders; pick `none` when the match is coincidental.", candidates: senders.map((s, i) => ({ id: `s${i}`, domain: s.domain, name: s.name ?? null })) },
        { none: "No candidate is what the user means.", ...Object.fromEntries(senders.map((s, i) => [`s${i}`, `${s.name ? s.name + ", " : ""}${s.domain}`])) }),
    } : {}),
    topic_literal: noul("Does the query name a specific subject, product, place, or phrase that should be matched as words in the email text, beyond category, sender, time, and status words?", { true: "There is a concrete topic to search for as text.", false: "The query is only about kind, sender, time, or status." }),
    wants_reply: noul("Is the user looking for mail that still needs their reply or action?", { true: "They want things they owe a response to.", false: "Not about replies or pending action." }),
    wants_people: noul("Does the user want mail written by real people rather than automated senders?", { true: "Humans only, not newsletters, notifications, or campaigns.", false: "No preference about human versus automated." }),
    wants_count: noul("Is the user asking for a number, such as how many messages match?", { true: "A count is the answer they want.", false: "They want to see the messages." }),
  } as const;

  const res = await ts().systemOne({ state: { query: q, current_date: now.toISOString().slice(0, 10), weekday: now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }), candidate_senders: senders.map((s, i) => ({ id: `s${i}`, domain: s.domain, name: s.name ?? null })), residual_terms: topic || null }, questions });
  const a = res.answers as Record<string, { type: string; choice?: string; confidence?: number; noul?: number }>;

  // Category
  const cat = (a.category?.choice ?? "any") as CategoryId | "any";
  const catConf = a.category?.confidence ?? 0;
  // "From real people" is a filter on humans, not on the Personal label, so skip the label in that case.
  const peopleIntent = flags.includes("fromPeople") || (a.wants_people?.noul ?? 0) >= 0.6;
  if (cat !== "any" && cat !== "other" && catConf >= 0.6 && !(cat === "personal" && peopleIntent)) {
    const label = LABEL_BY_CATEGORY[cat];
    if (label && (!ctx.hasLabel || ctx.hasLabel(label))) { clauses.push(`label:"${label}"`); parts.push({ kind: "category", label: "Category", value: label, source: "ai" }); }
    else if (cat === "marketing") { clauses.push("category:promotions"); parts.push({ kind: "category", label: "Tab", value: "Promotions", source: "ai" }); }
    else if (cat === "social") { clauses.push("category:social"); parts.push({ kind: "category", label: "Tab", value: "Social", source: "ai" }); }
  }

  // Sender
  const chosen = a.sender?.choice && a.sender.choice !== "none" ? senders[Number(a.sender.choice.slice(1))] : undefined;
  const senderDomains = chosen ? [chosen.domain] : [];
  if (chosen) { clauses.push(`from:${chosen.domain}`); parts.push({ kind: "sender", label: "From", value: chosen.name ? `${chosen.name} (${chosen.domain})` : chosen.domain, source: "ai" }); }

  // Time
  let timeWindow: TimeWindow | "explicit" = "any";
  if (explicit) { clauses.push(explicit.gmail); parts.push({ kind: "time", label: "When", value: explicit.label, source: "rule" }); timeWindow = "explicit"; }
  else {
    const twConf = a.time_window?.confidence ?? 0;
    const tw = (twConf >= 0.5 ? (a.time_window?.choice ?? "any") : "any") as TimeWindow;
    const g = timeToGmail(tw, now);
    if (g) { clauses.push(g); parts.push({ kind: "time", label: "When", value: tw.replace(/_/g, " "), source: "ai" }); }
    timeWindow = tw;
  }

  // Flags
  const flagSet = new Set(flags);
  if ((a.wants_reply?.noul ?? 0) >= 0.65) flagSet.add("needsReply");
  if ((a.wants_people?.noul ?? 0) >= 0.6) flagSet.add("fromPeople");
  for (const f of flagSet) {
    switch (f) {
      case "unread": clauses.push("is:unread"); parts.push({ kind: "flag", label: "Status", value: "unread", source: "rule" }); break;
      case "starred": clauses.push("is:starred"); parts.push({ kind: "flag", label: "Status", value: "starred", source: "rule" }); break;
      case "attachments": clauses.push("has:attachment"); parts.push({ kind: "flag", label: "Has", value: "attachment", source: "rule" }); break;
      case "important": clauses.push("is:important"); parts.push({ kind: "flag", label: "Status", value: "important", source: "rule" }); break;
      case "sentByMe": clauses.push("from:me"); parts.push({ kind: "flag", label: "From", value: "me", source: "rule" }); break;
      case "inTrash": clauses.push("in:trash"); parts.push({ kind: "flag", label: "In", value: "Trash", source: "rule" }); break;
      case "inInbox": clauses.push("in:inbox"); parts.push({ kind: "flag", label: "In", value: "Inbox", source: "rule" }); break;
      case "large": clauses.push("larger:5M"); parts.push({ kind: "flag", label: "Size", value: "over 5 MB", source: "rule" }); break;
      case "needsReply": clauses.push("-from:me"); if (!flagSet.has("unread")) clauses.push("category:primary"); parts.push({ kind: "flag", label: "Intent", value: "needs my reply (Jev ranks)", source: "ai" }); break;
      case "fromPeople": clauses.push("-category:promotions -category:social -category:updates -category:forums"); parts.push({ kind: "flag", label: "Intent", value: "from real people (Jev filters)", source: "ai" }); break;
      case "trashCandidates": clauses.push("-is:starred"); parts.push({ kind: "flag", label: "Intent", value: "disposable (Jev scores)", source: "rule" }); break;
    }
  }
  if (flagSet.has("inTrash")) { /* keep */ } else if (!clauses.some((c) => c.includes("in:trash"))) clauses.push("-in:trash");

  // Topic terms
  const literal = (a.topic_literal?.noul ?? 0) >= 0.5 && topic.length > 0;
  if (literal) { clauses.unshift(topic.split(" ").length > 1 ? `(${topic})` : topic); parts.push({ kind: "topic", label: "Text", value: topic, source: "ai" }); }

  return {
    input: q, gmail: clauses.join(" ").replace(/\s+/g, " ").trim(), parts,
    category: cat === "other" ? "any" : cat, timeWindow, senders: senderDomains, flags: [...flagSet], topic: literal ? topic : "",
    count: (a.wants_count?.noul ?? 0) >= 0.6 || /\bhow many\b|\bcount\b|\bnumber of\b/i.test(q),
    rerank: { relevance: literal, needsReply: flagSet.has("needsReply"), human: flagSet.has("fromPeople"), disposable: flagSet.has("trashCandidates") },
    usage: { inputTokens: res.usage.input_tokens, requests: 1 }, model: res.model,
  };
}
