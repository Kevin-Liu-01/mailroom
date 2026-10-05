import { z } from "zod";

// The opinionated taxonomy. Label names are what the user sees in Gmail; ids are stable keys for code and TypeSafe.
export const CATEGORIES = [
  { id: "work", label: "Work", description: "Mail from colleagues, clients, customers, or tools tied to the user's job or company." },
  { id: "personal", label: "Personal", description: "A real person writing to the user about non-work life: friends, family, neighbors, landlords, doctors' offices writing personally." },
  { id: "finance", label: "Banking & Finance", description: "Banks, cards, brokerages, taxes, insurance, payroll, bills, loan servicers, credit bureaus. Statements and alerts, not shopping." },
  { id: "receipts", label: "Receipts", description: "Order confirmations, shipping and delivery notices, ride and food delivery receipts, invoices for a specific purchase." },
  { id: "travel", label: "Trips & Travel", description: "Flights, trains, hotels, car rentals, itineraries, boarding passes, loyalty-program account mail." },
  { id: "events", label: "Events", description: "Event tickets, RSVPs, calendar invitations, meetups, conference logistics, reminders for a scheduled thing." },
  { id: "recruiting", label: "Recruiting", description: "Recruiters, job boards, hiring outreach, interview scheduling, application status, talent platforms." },
  { id: "school", label: "School", description: "A university or school: registrar, courses, campus offices, alumni relations, student clubs." },
  { id: "dev", label: "Dev Notifications", description: "Automated developer tooling: CI, deploy previews, pull requests, issue trackers, error monitors, cloud usage notices, package registries." },
  { id: "social", label: "Social Media", description: "Notifications from social networks and communities: connection requests, likes, mentions, digests, group activity." },
  { id: "newsletters", label: "Newsletters", description: "Periodic editorial content the user subscribed to: news briefs, essays, industry roundups, substacks." },
  { id: "marketing", label: "Marketing & Deals", description: "Promotions, sales, coupons, product announcements, drip campaigns, loyalty offers from brands." },
  { id: "security", label: "Accounts & Security", description: "Verification codes, one-time passwords, sign-in alerts, password resets, new-device notices, account-change confirmations." },
  { id: "other", label: null, description: "Nothing above fits, or there is too little information to tell." },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const LABEL_BY_CATEGORY: Record<CategoryId, string | null> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<CategoryId, string | null>;

// Labels the engine adds beyond the taxonomy.
export const ACTION_LABEL = "Action Needed";
export const AI_LABEL = "Mailroom/AI Sorted";

const day = z.number().int().min(1).max(3650);
const nullableDay = day.nullable();

const FILE_CATEGORY_IDS = CATEGORY_IDS.filter((c) => c !== "other") as [Exclude<CategoryId, "other">, ...Exclude<CategoryId, "other">[]];

/** One route: mail from these senders (optionally only with, or except, these subject words) files into a category. */
export const RouteSchema = z.object({
  category: z.enum(FILE_CATEGORY_IDS),
  sub: z.string().trim().min(1).max(40).regex(/^[^/"]+$/, "A sub-label cannot contain / or quotes").optional(),
  from: z.string().trim().min(3).max(1800).optional(),
  subject: z.string().trim().min(1).max(1200).optional(),
  except: z.string().trim().min(1).max(600).optional(),
  star: z.boolean().optional(),
}).refine((r) => Boolean(r.from || r.subject), { message: "A route needs senders or subject words" });

export const PolicySchema = z.object({
  version: z.literal(1),
  categories: z.object({
    // Categories that leave the inbox on arrival (still labeled and searchable).
    skipInbox: z.array(z.enum(CATEGORY_IDS)).default(["dev", "receipts"]),
    // Categories whose mail is never marked important by Gmail's importance markers.
    neverImportant: z.array(z.enum(CATEGORY_IDS)).default(["dev", "social", "newsletters", "marketing"]),
    // Categories Gmail should always treat as important.
    alwaysImportant: z.array(z.enum(CATEGORY_IDS)).default(["work"]),
    // Categories that are never trashed by any rule, whatever else says.
    protected: z.array(z.enum(CATEGORY_IDS)).default(["work", "personal", "finance", "travel", "events", "recruiting", "school"]),
  }).prefault({}),
  aging: z.object({
    // Mail in a skip-inbox category that is still in the inbox after this many days gets archived.
    archiveStragglersAfterDays: day.default(2),
    trashSecurityCodesAfterDays: nullableDay.default(30),
    trashDevAfterDays: nullableDay.default(90),
    trashSocialAfterDays: nullableDay.default(90),
    // Off by default: promotions stay in the Promotions tab, just marked read and not important.
    trashMarketingAfterDays: nullableDay.default(null),
    markReadPromotionsAfterDays: nullableDay.default(14),
    markReadSocialAfterDays: nullableDay.default(14),
    markReadUpdatesAfterDays: nullableDay.default(30),
    maxTrashPerRule: z.number().int().min(0).max(50000).default(8000),
  }).prefault({}),
  senders: z.object({
    // Domains whose mail is demoted from important and labeled Marketing & Deals.
    heavyPromo: z.array(z.string().min(3)).default([]),
    // Domains always labeled Work (and important).
    work: z.array(z.string().min(3)).default([]),
    // Domains always labeled Personal (and important).
    family: z.array(z.string().min(3)).default([]),
    // Domains no rule and no AI decision may ever trash or archive.
    protected: z.array(z.string().min(3)).default([]),
    // Per-sender aging: mail from this domain older than N days goes to Trash.
    trashAfterDays: z.record(z.string().min(3), day).default({}),
  }).prefault({}),
  filing: z.object({
    // Your own routes. They add to the built-in ones and win over them where both name a sender.
    routes: z.array(RouteSchema).max(150).default([]),
    // Built-in routes you have turned off, by id.
    builtinsOff: z.array(z.string().min(1).max(60)).max(60).default([]),
  }).prefault({}),
  ai: z.object({
    enabled: z.boolean().default(true),
    // Only Primary-tab mail with no taxonomy label is judged; deterministic rules handle the rest for free.
    lookbackDays: z.number().int().min(1).max(365).default(30),
    maxMessagesPerRun: z.number().int().min(0).max(2000).default(300),
    // Apply the category label when the Choice confidence is at least this.
    labelConfidence: z.number().min(0).max(1).default(0.6),
    // Archive automated mail out of Primary when the automated probability is at least this (only for these categories).
    archiveAutomated: z.boolean().default(true),
    archiveAutomatedThreshold: z.number().min(0).max(1).default(0.85),
    archiveCategories: z.array(z.enum(CATEGORY_IDS)).default(["marketing", "newsletters", "social", "dev", "recruiting"]),
    // Label "Action Needed" when the needs-action probability is at least this.
    flagActionThreshold: z.number().min(0).max(1).default(0.7),
    budgetUsdPerRun: z.number().min(0).max(50).default(0.25),
  }).prefault({}),
  schedule: z.object({
    enabled: z.boolean().default(true),
    // Vercel Cron runs daily; the mailbox can opt out here without losing the config.
  }).prefault({}),
});

export type PolicyConfig = z.infer<typeof PolicySchema>;

export function defaultPolicy(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return PolicySchema.parse({ version: 1, ...overrides });
}

export function parsePolicy(input: unknown): PolicyConfig {
  return PolicySchema.parse(input);
}

/**
 * A stored policy, brought up to the current schema: sections added since it was saved get their defaults. If it no
 * longer validates, each section falls back to defaults on its own, so one bad field never wipes the rest.
 */
export function normalizePolicy(input: unknown): PolicyConfig {
  const parsed = PolicySchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const base = defaultPolicy();
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const section = <K extends keyof PolicyConfig>(key: K): PolicyConfig[K] => {
    const merged = { ...(base[key] as object), ...((raw[key] as object | undefined) ?? {}) };
    const ok = PolicySchema.shape[key].safeParse(merged);
    return (ok.success ? ok.data : base[key]) as PolicyConfig[K];
  };
  return { version: 1, categories: section("categories"), aging: section("aging"), senders: section("senders"), filing: section("filing"), ai: section("ai"), schedule: section("schedule") };
}
