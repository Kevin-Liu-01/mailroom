import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { PolicyConfig } from "@/lib/policy/schema";

// ---- Auth.js tables (Drizzle adapter shape) ----
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    // Encrypted with TOKEN_ENCRYPTION_KEY (see src/lib/crypto.ts). Never stored in plain text.
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---- Mailroom tables ----
export type MailboxStatus = "active" | "paused" | "needs_reauth";

export const mailboxes = pgTable("mailboxes", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  policy: jsonb("policy").$type<PolicyConfig>().notNull(),
  scheduleEnabled: boolean("schedule_enabled").default(true).notNull(),
  status: text("status").$type<MailboxStatus>().default("active").notNull(),
  labelsReady: boolean("labels_ready").default(false).notNull(),
  lastRunAt: timestamp("last_run_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type RunMode = "dry-run" | "apply";
export type RunTrigger = "manual" | "cron";
export type RunStatus = "running" | "ok" | "error" | "undone";

export type RuleResult = {
  id: string;
  kind: "archive" | "trash" | "read" | "importance" | "label" | "ai";
  query?: string;
  matched: number;
  applied: number;
  skipped?: string;
  error?: string;
};

export type AiUsage = {
  messagesConsidered: number;
  messagesJudged: number;
  cacheHits: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  model?: string;
};

export type RunSummary = {
  rules: RuleResult[];
  ai?: AiUsage & { labeled: number; archived: number; flaggedAction: number };
  totalApplied: number;
  durationMs: number;
};

export const runs = pgTable("runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").$type<RunMode>().notNull(),
  trigger: text("trigger").$type<RunTrigger>().notNull(),
  status: text("status").$type<RunStatus>().default("running").notNull(),
  summary: jsonb("summary").$type<RunSummary>(),
  error: text("error"),
  startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { mode: "date" }),
});

// One row per batchModify we sent: enough to undo it (inverse label change) within Gmail's 30-day Trash window.
export const runBatches = pgTable("run_batches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  messageIds: jsonb("message_ids").$type<string[]>().notNull(),
  addLabelIds: jsonb("add_label_ids").$type<string[]>().notNull(),
  removeLabelIds: jsonb("remove_label_ids").$type<string[]>().notNull(),
  // What undo puts back. Labels whose prior state we cannot know (UNREAD, IMPORTANT) are never restored.
  restoreLabelIds: jsonb("restore_label_ids").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type Judgment = {
  category: string;
  categoryConfidence: number;
  probabilities: Record<string, number>;
  automated: number;
  needsAction: number;
  timeSensitive: number;
};

// TypeSafe judgments are cached per message so a message is only ever paid for once.
export const aiJudgments = pgTable(
  "ai_judgments",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    threadId: text("thread_id"),
    from: text("from_header"),
    subject: text("subject"),
    receivedAt: timestamp("received_at", { mode: "date" }),
    judgment: jsonb("judgment").$type<Judgment>().notNull(),
    actions: jsonb("actions").$type<string[]>().default([]).notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.messageId] })],
);
