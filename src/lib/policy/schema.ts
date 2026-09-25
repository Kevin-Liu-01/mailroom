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

export const PolicySchema = z.object({
  version: z.literal(1),
  categories: z.object({
    // Categories that leave the inbox on arrival (still labeled and searchable).
    skipInbox: z.array(z.enum(CATEGORY_IDS)).default(["dev", "social", "receipts"]),
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
