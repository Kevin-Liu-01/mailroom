/** Words the compiler recognizes without asking the model. Everything else is either a sender hint or a topic term. */
export const STOPWORDS = new Set(
  "a an the of for from to in on at by with about and or but me my i im i'm mine our we us you your it its this that these those is are was were be been being do does did have has had show find search look get give list all any some every please can could would want wants need needs mail mails email emails message messages msg msgs thread threads stuff things thing anything something everything inbox gmail sent got received ones one".split(" "),
);

export const FLAG_WORDS: Record<string, RegExp> = {
  unread: /\b(unread|haven't read|havent read|not read|unopened)\b/i,
  starred: /\b(starred|stars?)\b/i,
  attachments: /\b(attachments?|attached|pdfs?|files?|invoice pdf)\b/i,
  important: /\b(important|priority)\b/i,
  sentByMe: /\b(i sent|sent by me|from me|my sent|i wrote|i emailed)\b/i,
  inTrash: /\b(in (the )?trash|trashed|deleted)\b/i,
  needsReply: /\b(need(s)? (a |my )?(reply|response|answer)|haven't (replied|answered|responded)|never (answered|replied|responded)|waiting on me|owe (a )?repl(y|ies)|unanswered|follow[- ]?up)\b/i,
  fromPeople: /\b(real (people|humans?)|actual (people|humans?)|from (a )?(person|people|humans?)|not automated|human)\b/i,
  trashCandidates: /\b(trash candidates?|safe to trash|can (i )?trash|should (i )?trash|junk|garbage|clutter|clean ?up)\b/i,
  inInbox: /\b(still in (my )?inbox|in (my )?inbox)\b/i,
  large: /\b(large|big|huge|heavy)\b/i,
};

/** Time windows the model may select. Keys are ids sent to TypeSafe; values render to Gmail. */
export const TIME_WINDOWS = {
  any: "No time restriction, or the query says nothing about when.",
  today: "Today only.",
  yesterday: "Yesterday only.",
  this_week: "This week (about the last 7 days).",
  last_2_weeks: "About the last two weeks.",
  last_30_days: "The last month or 30 days.",
  last_90_days: "The last quarter or 90 days.",
  last_6_months: "The last half year.",
  this_year: "This calendar year.",
  last_year: "The previous calendar year.",
  older_than_1_year: "Mail older than a year.",
  older_than_6_months: "Mail older than six months.",
  older_than_30_days: "Mail older than a month.",
} as const;
export type TimeWindow = keyof typeof TIME_WINDOWS;

export const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
