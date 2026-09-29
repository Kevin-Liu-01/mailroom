/** Words the compiler recognizes without asking the model. Everything else is a sender hint, a name, or a topic term. */
export const STOPWORDS = new Set(
  "a an the of for from to in on at by with about and or but me my i im i'm mine our we us you your it its this that these those is are was were be been being do does did have has had show find search look get give list all any some every please can could would want wants need needs mail mails email emails message messages msg msgs thread threads stuff things thing anything something everything inbox gmail sent got received ones one who which what where when how many much most still yet send sends sending get gets getting did does doing come came coming arrived arrive people person persons folks someone anyone everyone somebody anybody contacts guys".split(" "),
);

export const FLAG_WORDS: Record<string, RegExp> = {
  unread: /\b(unread|haven'?t read|not read|unopened|never (open|opened|read)|don'?t open|didn'?t open|haven'?t opened)\b/i,
  starred: /\b(starred|stars?)\b/i,
  attachments: /\b(attachments?|attached|files?)\b/i,
  pdf: /\b(pdfs?|invoice pdf)\b/i,
  important: /\b(important|priority)\b/i,
  sentByMe: /\b(i sent|sent by me|from me|my sent|i wrote|i emailed|messages? i sent|emails? i sent)\b/i,
  inTrash: /\b(in (the )?trash|trashed|deleted)\b/i,
  inInbox: /\b(still in (my )?inbox|in (my )?inbox)\b/i,
  large: /\b(large|big|huge|heavy)\b/i,
  // They owe me: I spoke last and nothing came back.
  waitingOnThem: /\b(waiting (on|for) (a |an |their |his |her )?(reply|response|answer)|haven'?t heard back|hasn'?t (replied|responded|answered|gotten back|written back)|(who|that|they|people|he|she) haven'?t (replied|responded|answered|written back|gotten back)|haven'?t (replied|responded|answered) (to me|to my|back)|didn'?t (reply|respond|answer|get back|write back)( to me| to my| back)|(got|received) no (reply|response|answer)|no (reply|response) yet|never (replied|responded|answered|got|wrote) back|ghosted)\b/i,
  // I owe them: they spoke last.
  needsReply: /\b(need(s)? (a |my )?(reply|response|answer)|(?<!(who|that|they|people|he|she) )(i )?haven'?t (replied|answered|responded)(?! (to me|to my|back))|i never (answered|replied|responded)|never answered(?! (me|back))|waiting on me|owe (a )?repl(y|ies)|unanswered|follow[- ]?up|owe them)\b/i,
  // Stricter than needsReply: threads where I have never written at all.
  neverAnswered: /\b(never (answered|replied|responded)(?! (to me|back))|didn'?t (answer|reply|respond)(?! (to me|back))|i ignored|left on read|never got back to)\b/i,
  fromPeople: /\b(real (people|humans?)|actual (people|humans?)|from (a )?(person|people|humans?)|not automated|humans?)\b/i,
  trashCandidates: /\b(trash candidates?|safe to trash|can (i )?trash|should (i )?trash|junk|garbage|clutter|clean ?up|get rid of)\b/i,
  dueSoon: /\b(due|deadlines?|expir(es|ing|e)|rsvp|respond by|reply by|by (mon|tues|wednes|thurs|fri|satur|sun)day|by tomorrow|by (the )?end of (the )?(week|month|day)|time[- ]sensitive|urgent|asap)\b/i,
  aggregate: /\b(who (emails?|emailed|sends?|sent|writes?|wrote) (to )?me (the )?most|top senders?|most (emails?|mail|messages) from|biggest senders?|which senders?|by sender|per sender|breakdown)\b/i,
};

/** Time windows. Keys are ids the model may select; code renders them to Gmail. */
export const TIME_WINDOWS = {
  any: "No time restriction, or the query says nothing about when.",
  today: "Today only.",
  yesterday: "Yesterday only.",
  this_week: "This week (about the last 7 days).",
  last_week: "The previous calendar week.",
  last_2_weeks: "About the last two weeks.",
  last_30_days: "The last month or 30 days.",
  last_month: "The previous calendar month.",
  last_90_days: "The last quarter or 90 days.",
  last_6_months: "The last half year.",
  this_year: "This calendar year.",
  last_year: "The previous calendar year.",
  older_than_1_year: "Mail older than a year.",
  older_than_6_months: "Mail older than six months.",
  older_than_30_days: "Mail older than a month.",
} as const;
export type TimeWindow = keyof typeof TIME_WINDOWS;

/** Phrases that pin a window without asking the model. Order matters: longer, more specific phrases first. */
export const TIME_PHRASES: { re: RegExp; window: TimeWindow }[] = [
  { re: /\b(older than|over|more than) (a|1|one) year\b|\bancient\b/i, window: "older_than_1_year" },
  { re: /\b(older than|over|more than) (6|six) months\b/i, window: "older_than_6_months" },
  { re: /\b(older than|over|more than) (a|1|one) month\b|\bolder than 30 days\b|\bold(er)?\b|\bstale\b/i, window: "older_than_30_days" },
  { re: /\btoday\b/i, window: "today" },
  { re: /\byesterday\b/i, window: "yesterday" },
  { re: /\blast week\b/i, window: "last_week" },
  { re: /\b(this|past) week\b|\b(last|past) (7|seven) days\b/i, window: "this_week" },
  { re: /\b(last|past) (2|two) weeks\b|\bfortnight\b/i, window: "last_2_weeks" },
  { re: /\blast month\b/i, window: "last_month" },
  { re: /\b(this|past) month\b|\b(last|past) 30 days\b/i, window: "last_30_days" },
  { re: /\b(this|past|last) quarter\b|\b(last|past) 90 days\b|\b(last|past) (3|three) months\b/i, window: "last_90_days" },
  { re: /\b(last|past) (6|six) months\b|\bhalf year\b/i, window: "last_6_months" },
  { re: /\bthis year\b/i, window: "this_year" },
  { re: /\blast year\b/i, window: "last_year" },
];

export const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Words that describe a kind of mail rather than its content. Never searched literally. */
export const KIND_WORDS = new Set(
  "receipt receipts order orders shipping shipped delivery delivered invoice invoices bill bills statement statements payment payments refund refunds return returns promo promos promotion promotions deal deals sale sales offer offers coupon coupons newsletter newsletters digest digests recruiter recruiters recruiting job jobs role roles opportunity opportunities interview interviews security code codes verification verify otp 2fa sign-in signin login password passwords alert alerts notification notifications notice notices bank banking finance financial travel trip trips flight flights hotel hotels booking bookings itinerary event events invite invites invitation invitations calendar meeting meetings social dev deploy deploys deployment build builds github work personal school class classes marketing update updates spam confirmation confirmations subscription subscriptions account accounts ticket tickets reminder reminders".split(" "),
);
