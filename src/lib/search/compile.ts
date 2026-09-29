/**
 * Natural language -> Gmail query. Code finds the candidates (senders, dates, flags, residual terms);
 * Jev decides among them in one request (category, time, sender, the role of each leftover word, and the
 * user's intent); code assembles the query and keeps every probability so the UI can show its reasoning.
 */
import { choice, noul } from "@typesafe-ai/sdk";
import { jev } from "@/lib/ai/client";
import { CATEGORIES, LABEL_BY_CATEGORY, type CategoryId } from "@/lib/policy/schema";
import { FLAG_WORDS, KIND_WORDS, MONTHS, STOPWORDS, TIME_PHRASES, TIME_WINDOWS, type TimeWindow } from "./lexicon";

export type KnownSender = { domain: string; name?: string | null };
export type QueryPart = { kind: "category" | "sender" | "name" | "time" | "flag" | "topic" | "intent"; label: string; value: string; source: "rule" | "ai"; confidence?: number };
export type TermRole = "topic" | "name" | "kind";
export type Intents = { needsReply: boolean; waiting: boolean; neverAnswered: boolean; people: boolean; count: boolean; aggregate: boolean; dueSoon: boolean; trash: boolean };
export type JevReading = {
  category: { choice: string; confidence: number; probabilities: { id: string; label: string; p: number }[] };
  timeWindow: { choice: string; confidence: number; source: "rule" | "ai" | "none" };
  sender: { choice: string; confidence: number } | null;
  terms: { term: string; role: TermRole; confidence: number }[];
  intents: { reply: number; people: number; count: number; waiting: number };
};
export type CompiledQuery = {
  input: string;
  gmail: string;
  parts: QueryPart[];
  category: CategoryId | "any";
  timeWindow: TimeWindow | "explicit";
  senders: string[];
  names: string[];
  flags: string[];
  topic: string;
  intents: Intents;
  /** The user asked how many, not which. */
  count: boolean;
  /** Threads need who-spoke-last context before ranking. */
  threadAware: boolean;
  /** Rerank hints for the result stage. */
  rerank: { relevance: boolean; needsReply: boolean; human: boolean; disposable: boolean; urgency: boolean; waiting: boolean };
  jev: JevReading;
  usage: { inputTokens: number; requests: number };
  model?: string;
};

const fmt = (d: Date) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function timeToGmail(window: TimeWindow, now: Date): string {
  const y = now.getUTCFullYear();
  const today = utcDay(now);
  switch (window) {
    case "today": return "newer_than:1d";
    case "yesterday": { const d = new Date(today); d.setUTCDate(d.getUTCDate() - 1); return `after:${fmt(d)} before:${fmt(today)}`; }
    case "this_week": return "newer_than:7d";
    case "last_week": {
      const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
      const thisMonday = new Date(today); thisMonday.setUTCDate(today.getUTCDate() - dow);
      const lastMonday = new Date(thisMonday); lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
      return `after:${fmt(lastMonday)} before:${fmt(thisMonday)}`;
    }
    case "last_2_weeks": return "newer_than:14d";
    case "last_30_days": return "newer_than:30d";
    case "last_month": {
      const start = new Date(Date.UTC(y, now.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(y, now.getUTCMonth(), 1));
      return `after:${fmt(start)} before:${fmt(end)}`;
    }
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

/** Explicit month names, years, and "last N units" become exact ranges without asking the model. */
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

/** A time phrase the lexicon knows, or null. */
export function phraseWindow(q: string): TimeWindow | null {
  for (const { re, window } of TIME_PHRASES) if (re.test(q)) return window;
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

const CATEGORY_WORDS = new Set([...KIND_WORDS, ...CATEGORIES.flatMap((c) => (c.label ?? "").toLowerCase().split(/[\s&/]+/).filter(Boolean))]);

/** Words left after senders, flags, dates, and kind words are removed: the model decides what each one is. */
export function residualTerms(q: string, senders: KnownSender[], flags: string[]): string[] {
  let text = q.toLowerCase();
  const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const s of senders) {
    text = text.replace(new RegExp(esc(s.domain), "g"), " ");
    for (const part of s.domain.split(/[@.]/)) if (part.length >= 3 && !["com", "org", "net", "mail", "email", "news", "info"].includes(part)) text = text.replace(new RegExp(`\\b${esc(part)}\\b`, "g"), " ");
    for (const w of (s.name ?? "").toLowerCase().split(/\s+/)) if (w.length >= 3) text = text.replace(new RegExp(`\\b${esc(w)}\\b`, "g"), " ");
  }
  for (const f of flags) text = text.replace(FLAG_WORDS[f], " ");
  for (const { re } of TIME_PHRASES) text = text.replace(re, " ");
  text = text.replace(/\b(last|past|previous|this|next)\s+(\d+\s*)?(day|week|month|year|quarter)s?\b/g, " ").replace(/\b(today|yesterday|recent|recently|old|older|newer|ago|since|before|after|until)\b/g, " ").replace(/\b20\d{2}\b/g, " ");
  for (const m of MONTHS) text = text.replace(new RegExp(`\\b${m.slice(0, 3)}[a-z]*\\b`, "g"), " ");
  const words = tokens(text).filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !CATEGORY_WORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].slice(0, 6);
}

/** Back-compat: the residual terms as one string. */
export function residualTopic(q: string, senders: KnownSender[], flags: string[]): string {
  return residualTerms(q, senders, flags).join(" ");
}

const categoryCriteria = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label ? `${c.label}: ${c.description}` : "The query names no category (use `any` instead of this)."])),
  any: "The query does not restrict to one category of mail.",
} as Record<string, string>;
const categoryLabel = (id: string) => (id === "any" ? "any" : (LABEL_BY_CATEGORY[id as CategoryId] ?? id));

const termCriteria = {
  topic: "A specific subject, product, place, project, or phrase to match as words in the email text.",
  name: "The name of a person, company, or organization the mail is from or addressed to; match it against sender and recipient names, not the text.",
  kind: "Describes what kind of mail it is, its status, or when it arrived. Not matched literally.",
} as const;

export async function compileSearch(input: string, ctx: { now?: Date; knownSenders?: KnownSender[]; hasLabel?: (name: string) => boolean }): Promise<CompiledQuery> {
  const now = ctx.now ?? new Date();
  const q = input.trim();
  const flags = detectFlags(q);
  const senders = senderCandidates(q, ctx.knownSenders ?? []);
  const explicit = explicitDateRange(q, now);
  const phrase = explicit ? null : phraseWindow(q);
  const terms = residualTerms(q, senders, flags);
  const words = tokens(q);
  const mentionsKind = words.some((w) => CATEGORY_WORDS.has(w));
  const parts: QueryPart[] = [];
  const clauses: string[] = [];

  const questions = {
    category: choice({ question: "Which mailbox category does the search ask for? Choose `any` when the query names none.", note: "Receipts covers orders, rides, food delivery, shipping, refunds. Recruiting covers job outreach. Accounts & Security covers codes and sign-in alerts. A named sender alone does not imply a category." }, categoryCriteria),
    ...(!explicit && !phrase ? {
      time_window: choice({ question: "Which time window does the query ask for? Choose `any` unless the query itself mentions a time.", note: "`current_date` only resolves relative words; it is not evidence that the user asked about today." }, TIME_WINDOWS as unknown as Record<string, string>),
    } : {}),
    ...(senders.length ? {
      sender: choice({ question: "Which candidate sender, if any, does the query refer to? Candidates were found by matching words of the query against known senders; pick `none` when the match is coincidental.", candidates: senders.map((s, i) => ({ id: `s${i}`, domain: s.domain, name: s.name ?? null })) },
        { none: "No candidate is what the user means.", ...Object.fromEntries(senders.map((s, i) => [`s${i}`, `${s.name ? s.name + ", " : ""}${s.domain}`])) }),
    } : {}),
    ...Object.fromEntries(terms.map((t, i) => [`term_${i}`, choice({ question: `What role does the word "${t}" play in the query in \`query\`?`, note: "Names of people and companies are `name` even when written in lowercase. Words that describe a kind of mail, such as receipts, codes, alerts, or newsletters, are `kind`." }, termCriteria)])),
    wants_reply: noul("Is the user looking for conversations where they still owe the other side a reply or action?", { true: "They want what they owe a response to.", false: "Not about replies they owe." }),
    wants_waiting: noul("Is the user looking for conversations where they wrote last and are waiting on someone else to respond?", { true: "They want what others owe them.", false: "Not about waiting on others." }),
    wants_people: noul("Does the user want mail written by real people rather than automated senders?", { true: "Humans only, not newsletters, notifications, or campaigns.", false: "No preference about human versus automated." }),
    wants_count: noul("Is the user asking for a number or a breakdown, such as how many messages match or who sends the most?", { true: "A count or tally is the answer they want.", false: "They want to see the messages." }),
  } as const;

  const res = await jev().systemOne({
    state: { query: q, current_date: now.toISOString().slice(0, 10), weekday: now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }), candidate_senders: senders.map((s, i) => ({ id: `s${i}`, domain: s.domain, name: s.name ?? null })), leftover_terms: terms },
    questions,
  });
  const a = res.answers as Record<string, { type: string; choice?: string; confidence?: number; probabilities?: Record<string, number>; noul?: number }>;

  // Intents: explicit words always win; Jev adds what the wording implied.
  const flagSet = new Set(flags);
  const p = (k: string) => a[k]?.noul ?? 0;
  if (p("wants_reply") >= 0.65 && !flagSet.has("waitingOnThem")) flagSet.add("needsReply");
  if (p("wants_waiting") >= 0.7 && !flagSet.has("needsReply")) flagSet.add("waitingOnThem");
  if (p("wants_people") >= 0.6) flagSet.add("fromPeople");
  const intents: Intents = {
    needsReply: flagSet.has("needsReply") || flagSet.has("neverAnswered"),
    waiting: flagSet.has("waitingOnThem"),
    neverAnswered: flagSet.has("neverAnswered"),
    people: flagSet.has("fromPeople"),
    count: p("wants_count") >= 0.6 || flagSet.has("aggregate") || /\bhow many\b|\bcount\b|\bnumber of\b/i.test(q),
    aggregate: flagSet.has("aggregate"),
    dueSoon: flagSet.has("dueSoon"),
    trash: flagSet.has("trashCandidates"),
  };

  // Terms: names become from:/to: filters, topics become literal text, kind words vanish.
  const termReadings = terms.map((t, i) => ({ term: t, role: ((a[`term_${i}`]?.choice as TermRole) ?? "kind"), confidence: a[`term_${i}`]?.confidence ?? 0 }));
  const names = termReadings.filter((t) => t.role === "name").map((t) => t.term);
  const topicTerms = termReadings.filter((t) => t.role === "topic").map((t) => t.term);

  // Sender
  const chosen = a.sender?.choice && a.sender.choice !== "none" ? senders[Number(a.sender.choice.slice(1))] : undefined;
  const senderDomains = chosen ? [chosen.domain] : [];
  if (chosen) { clauses.push(intents.waiting ? `to:${chosen.domain}` : `from:${chosen.domain}`); parts.push({ kind: "sender", label: intents.waiting ? "To" : "From", value: chosen.name ? `${chosen.name} (${chosen.domain})` : chosen.domain, source: "ai", confidence: a.sender?.confidence }); }
  for (const n of names) { clauses.push(intents.waiting ? `to:${n}` : `from:${n}`); parts.push({ kind: "name", label: intents.waiting ? "To" : "From", value: n, source: "ai", confidence: termReadings.find((t) => t.term === n)?.confidence }); }

  // Category: only when the query talks about a kind of mail. A named sender is enough on its own.
  const cat = (a.category?.choice ?? "any") as CategoryId | "any";
  const catConf = a.category?.confidence ?? 0;
  const namedSomeone = Boolean(chosen) || names.length > 0;
  const wantsAll = /\b(everything|anything|all)\b/i.test(q);
  const skipForPeople = cat === "personal" && intents.people;
  let label: string | null = null;
  if (cat !== "any" && cat !== "other" && catConf >= 0.6 && !skipForPeople && (!namedSomeone || (mentionsKind && !wantsAll))) {
    label = LABEL_BY_CATEGORY[cat];
    if (label && (!ctx.hasLabel || ctx.hasLabel(label))) { clauses.push(`label:"${label}"`); parts.push({ kind: "category", label: "Category", value: label, source: "ai", confidence: catConf }); }
    else if (cat === "marketing") { clauses.push("category:promotions"); parts.push({ kind: "category", label: "Tab", value: "Promotions", source: "ai", confidence: catConf }); label = "Promotions"; }
    else if (cat === "social") { clauses.push("category:social"); parts.push({ kind: "category", label: "Tab", value: "Social", source: "ai", confidence: catConf }); label = "Social"; }
    else label = null;
  }

  // Time
  let timeWindow: TimeWindow | "explicit" = "any";
  let timeReading: JevReading["timeWindow"] = { choice: "any", confidence: 1, source: "none" };
  if (explicit) { clauses.push(explicit.gmail); parts.push({ kind: "time", label: "When", value: explicit.label, source: "rule" }); timeWindow = "explicit"; timeReading = { choice: explicit.label, confidence: 1, source: "rule" }; }
  else if (phrase) { const g = timeToGmail(phrase, now); if (g) { clauses.push(g); parts.push({ kind: "time", label: "When", value: phrase.replace(/_/g, " "), source: "rule" }); } timeWindow = phrase; timeReading = { choice: phrase, confidence: 1, source: "rule" }; }
  else {
    const twConf = a.time_window?.confidence ?? 0;
    const tw = (twConf >= 0.5 ? (a.time_window?.choice ?? "any") : "any") as TimeWindow;
    const g = timeToGmail(tw, now);
    if (g) { clauses.push(g); parts.push({ kind: "time", label: "When", value: tw.replace(/_/g, " "), source: "ai", confidence: twConf }); }
    timeWindow = tw;
    timeReading = { choice: a.time_window?.choice ?? "any", confidence: twConf, source: "ai" };
  }
  const hasTime = timeWindow !== "any";

  // Status flags
  for (const f of flagSet) {
    switch (f) {
      case "unread": clauses.push("is:unread"); parts.push({ kind: "flag", label: "Status", value: "unread", source: "rule" }); break;
      case "alreadyRead": if (!flagSet.has("unread")) { clauses.push("-is:unread"); parts.push({ kind: "flag", label: "Status", value: "read", source: "rule" }); } break;
      case "starred": clauses.push("is:starred"); parts.push({ kind: "flag", label: "Status", value: "starred", source: "rule" }); break;
      case "attachments": if (!flagSet.has("pdf")) { clauses.push("has:attachment"); parts.push({ kind: "flag", label: "Has", value: "attachment", source: "rule" }); } break;
      case "pdf": clauses.push("filename:pdf"); parts.push({ kind: "flag", label: "Has", value: "PDF", source: "rule" }); break;
      case "important": clauses.push("is:important"); parts.push({ kind: "flag", label: "Status", value: "important", source: "rule" }); break;
      case "sentByMe": if (!intents.waiting) { clauses.push("from:me"); parts.push({ kind: "flag", label: "From", value: "me", source: "rule" }); } break;
      case "inTrash": clauses.push("in:trash"); parts.push({ kind: "flag", label: "In", value: "Trash", source: "rule" }); break;
      case "inInbox": clauses.push("in:inbox"); parts.push({ kind: "flag", label: "In", value: "Inbox", source: "rule" }); break;
      case "large": clauses.push("larger:5M"); parts.push({ kind: "flag", label: "Size", value: "over 5 MB", source: "rule" }); break;
    }
  }

  // Intent clauses
  if (intents.waiting) {
    clauses.push("from:me");
    parts.push({ kind: "intent", label: "Intent", value: "waiting on them: I spoke last", source: flagSet.has("waitingOnThem") && flags.includes("waitingOnThem") ? "rule" : "ai", confidence: p("wants_waiting") });
  } else if (intents.needsReply) {
    clauses.push("-from:me");
    if (!label && !namedSomeone) clauses.push("category:primary");
    parts.push({ kind: "intent", label: "Intent", value: intents.neverAnswered ? "never answered: no message from me in the thread" : "needs my reply: they spoke last", source: flags.includes("needsReply") || flags.includes("neverAnswered") ? "rule" : "ai", confidence: p("wants_reply") });
  }
  if (intents.people) {
    if (!label) clauses.push("-category:promotions -category:social -category:updates -category:forums");
    parts.push({ kind: "intent", label: "Intent", value: "from real people (Jev filters)", source: flags.includes("fromPeople") ? "rule" : "ai", confidence: p("wants_people") });
  }
  if (intents.dueSoon) {
    if (!hasTime) clauses.push("newer_than:30d");
    parts.push({ kind: "intent", label: "Intent", value: "due soon (Jev ranks urgency)", source: "rule" });
  }
  if (intents.trash) {
    clauses.push("-is:starred -is:important");
    if (!label && !namedSomeone) clauses.push("-category:primary");
    if (!hasTime) clauses.push("older_than:30d");
    parts.push({ kind: "intent", label: "Intent", value: "disposable (Jev scores)", source: "rule" });
  }
  if (intents.aggregate) parts.push({ kind: "intent", label: "Answer", value: "who sends the most", source: "rule" });
  else if (intents.count) parts.push({ kind: "intent", label: "Answer", value: "a count", source: /\bhow many\b|\bcount\b|\bnumber of\b/i.test(q) ? "rule" : "ai", confidence: p("wants_count") });

  if (!flagSet.has("inTrash")) clauses.push("-in:trash");

  // Topic terms: literal words, all required.
  const topic = topicTerms.join(" ");
  if (topic) { clauses.unshift(topicTerms.length > 1 ? `(${topic})` : topic); parts.push({ kind: "topic", label: "Text", value: topic, source: "ai", confidence: Math.min(...topicTerms.map((t) => termReadings.find((r) => r.term === t)?.confidence ?? 0)) }); }

  const probs = Object.entries(a.category?.probabilities ?? {}).map(([id, pr]) => ({ id, label: categoryLabel(id), p: pr })).sort((x, y) => y.p - x.p).slice(0, 4);
  return {
    input: q, gmail: clauses.join(" ").replace(/\s+/g, " ").trim(), parts,
    category: cat === "other" ? "any" : cat, timeWindow, senders: senderDomains, names, flags: [...flagSet], topic, intents,
    count: intents.count,
    threadAware: intents.needsReply || intents.waiting || intents.neverAnswered,
    rerank: { relevance: topicTerms.length > 0, needsReply: intents.needsReply, human: intents.people, disposable: intents.trash, urgency: intents.dueSoon, waiting: intents.waiting },
    jev: { category: { choice: cat, confidence: catConf, probabilities: probs }, timeWindow: timeReading, sender: chosen ? { choice: chosen.domain, confidence: a.sender?.confidence ?? 0 } : null, terms: termReadings, intents: { reply: p("wants_reply"), people: p("wants_people"), count: p("wants_count"), waiting: p("wants_waiting") } },
    usage: { inputTokens: res.usage.input_tokens, requests: 1 }, model: res.model,
  };
}
