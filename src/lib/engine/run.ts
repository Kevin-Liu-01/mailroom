import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { GmailAuthError, GmailClient, mapLimit, refreshAccessToken, type GmailMessageMeta } from "@/lib/gmail/client";
import { ACTION_LABEL, AI_LABEL, LABEL_BY_CATEGORY, type CategoryId, type PolicyConfig } from "@/lib/policy/schema";
import { ALL_TAXONOMY_LABELS, buildFilters, buildRules, resolveRule } from "@/lib/policy/rules";
import { compileRoutes, routeLabelNames } from "@/lib/policy/routes";
import { applySync, planSync, toWanted, undoFilterChanges } from "./filters";
import { estimateCostUsd, triageMessage, USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";
import { resolveKey, withKey } from "@/lib/ai/client";
import { expandLabelQuery } from "@/lib/gmail/labels";
import { summarizeThread } from "@/lib/search/threads";
import type { AiUsage, FilterRecord, Judgment, RuleResult, RunMode, RunSummary, RunTrigger } from "@/db/schema";

const { accounts, aiJudgments, mailboxes, runBatches, runs } = schema;

export class MailboxError extends Error {}

/** Build an authenticated Gmail client for a user, refreshing the access token from the encrypted refresh token. */
export async function gmailFor(userId: string): Promise<{ gmail: GmailClient; email: string }> {
  const [acct] = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, "google"))).limit(1);
  if (!acct?.refresh_token) throw new GmailAuthError("No Google account with a refresh token is linked");
  const now = Math.floor(Date.now() / 1000);
  let accessToken = acct.access_token && acct.expires_at && acct.expires_at > now + 120 ? decryptSecret(acct.access_token) : null;
  if (!accessToken) {
    const fresh = await refreshAccessToken(decryptSecret(acct.refresh_token));
    accessToken = fresh.accessToken;
    await db.update(accounts).set({ access_token: encryptSecret(fresh.accessToken), expires_at: fresh.expiresAt })
      .where(and(eq(accounts.provider, "google"), eq(accounts.providerAccountId, acct.providerAccountId)));
  }
  const gmail = new GmailClient(accessToken);
  const [mb] = await db.select({ email: mailboxes.email }).from(mailboxes).where(eq(mailboxes.userId, userId)).limit(1);
  return { gmail, email: mb?.email ?? "" };
}

type BatchRecord = { ruleId: string; messageIds: string[]; addLabelIds: string[]; removeLabelIds: string[]; restoreLabelIds: string[] };

/**
 * Create the taxonomy labels and every label the routes file into, then (in apply mode) bring Gmail's filters in line
 * with the policy's routes. Only filters Mailroom owns are created or removed; a preview just counts the changes.
 */
export async function ensureSetup(gmail: GmailClient, policy: PolicyConfig, mode: RunMode, managedIds: string[]): Promise<{
  labels: Record<string, string>; managed: string[]; filters: { created: FilterRecord[]; deleted: FilterRecord[] }; planned: { create: number; remove: number }; errors: string[];
}> {
  const routeLabels = routeLabelNames(compileRoutes(policy).routes);
  const labels = await gmail.ensureLabels([...ALL_TAXONOMY_LABELS, ACTION_LABEL, AI_LABEL, ...routeLabels]);
  const managed = new Set(managedIds);
  const wanted = buildFilters(policy).map((spec) => toWanted(spec, labels));
  const plan = planSync(wanted, await gmail.listFilters(), managed);
  const planned = { create: plan.create.length, remove: plan.remove.length };
  if (mode !== "apply") return { labels, managed: managedIds, filters: { created: [], deleted: [] }, planned, errors: [] };
  const res = await applySync(gmail, plan, managed);
  return { labels, managed: res.managed, filters: { created: res.created, deleted: res.deleted }, planned, errors: res.errors };
}

export async function runMailbox(opts: { userId: string; mode: RunMode; trigger: RunTrigger }): Promise<{ runId: string; summary: RunSummary }> {
  const { userId, mode, trigger } = opts;
  const started = Date.now();
  const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.userId, userId)).limit(1);
  if (!mailbox) throw new MailboxError("Mailbox is not set up");
  const policy = mailbox.policy;
  const [run] = await db.insert(runs).values({ userId, mode, trigger }).returning({ id: runs.id });
  const results: RuleResult[] = [];
  const batches: BatchRecord[] = [];
  let totalApplied = 0;
  let filterChanges: RunSummary["filters"] = { created: [], deleted: [] };

  try {
    const { gmail, email } = await gmailFor(userId);
    const setup = await ensureSetup(gmail, policy, mode, mailbox.managedFilters);
    filterChanges = setup.filters;
    if (setup.planned.create || setup.planned.remove) {
      results.push({
        id: "sync-filters", kind: "label", matched: setup.planned.create + setup.planned.remove,
        applied: mode === "apply" ? setup.filters.created.length + setup.filters.deleted.length : 0,
        skipped: `${setup.planned.create} to create, ${setup.planned.remove} to remove`,
        ...(setup.errors.length ? { error: `Gmail refused ${setup.errors.length}: ${setup.errors.join("; ")}. Nothing was removed.` } : {}),
      });
    }
    const labels = setup.labels;
    if (mode === "apply") await db.update(mailboxes).set({ labelsReady: true, managedFilters: setup.managed }).where(eq(mailboxes.userId, userId));

    // 1. Deterministic rules: free, exact, re-runnable by hand.
    // Users who nest labels ("Receipts/Uber") keep working: every taxonomy label in a rule also matches its sublabels.
    const allLabelNames = (await gmail.listLabels()).map((l) => l.name);
    for (const raw of buildRules(policy)) {
      const rule = resolveRule(raw, labels);
      const query = expandLabelQuery(rule.query, allLabelNames);
      const entry: RuleResult = { id: rule.id, kind: rule.kind, query, matched: 0, applied: 0 };
      try {
        const ids = await gmail.listMessageIds(query);
        entry.matched = ids.length;
        if (rule.kind === "trash" && ids.length > policy.aging.maxTrashPerRule) {
          entry.skipped = `matched ${ids.length} > maxTrashPerRule ${policy.aging.maxTrashPerRule}; refused`;
        } else if (mode === "apply" && ids.length) {
          await gmail.batchModify(ids, rule.addLabelIds, rule.removeLabelIds);
          entry.applied = ids.length;
          totalApplied += ids.length;
          batches.push({
            ruleId: rule.id, messageIds: ids, addLabelIds: rule.addLabelIds, removeLabelIds: rule.removeLabelIds,
            restoreLabelIds: rule.query.includes("in:inbox") && rule.removeLabelIds.includes("INBOX") ? ["INBOX"] : [],
          });
        }
      } catch (err) {
        entry.error = err instanceof Error ? err.message : String(err);
      }
      results.push(entry);
    }

    // 2. TypeSafe triage of Primary mail the rules could not place.
    let ai: RunSummary["ai"] | undefined;
    if (policy.ai.enabled && policy.ai.maxMessagesPerRun > 0) {
      const key = await resolveKey(userId);
      if (key) {
        ai = await withKey(key.key, () => triagePrimary({ gmail, email, userId, policy, labels, mode, batches }));
        totalApplied += ai.labeled + ai.archived + ai.flaggedAction;
        results.push({ id: "ai-triage", kind: "ai", matched: ai.messagesConsidered, applied: ai.labeled + ai.archived + ai.flaggedAction });
      } else {
        results.push({ id: "ai-triage", kind: "ai", matched: 0, applied: 0, error: "No TypeSafe key on this account; add one in the dashboard." });
      }
    }

    if (batches.length) {
      await db.insert(runBatches).values(batches.map((b) => ({ runId: run.id, ...b })));
    }
    const summary: RunSummary = { rules: results, ai, totalApplied, durationMs: Date.now() - started };
    if (filterChanges.created.length || filterChanges.deleted.length) summary.filters = filterChanges;
    await db.update(runs).set({ status: "ok", summary, finishedAt: new Date() }).where(eq(runs.id, run.id));
    await db.update(mailboxes).set({ lastRunAt: new Date(), status: "active", updatedAt: new Date() }).where(eq(mailboxes.userId, userId));
    return { runId: run.id, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const summary: RunSummary = { rules: results, totalApplied, durationMs: Date.now() - started };
    if (filterChanges.created.length || filterChanges.deleted.length) summary.filters = filterChanges;
    await db.update(runs).set({ status: "error", error: message, summary, finishedAt: new Date() }).where(eq(runs.id, run.id));
    if (err instanceof GmailAuthError) {
      await db.update(mailboxes).set({ status: "needs_reauth", updatedAt: new Date() }).where(eq(mailboxes.userId, userId));
    }
    throw err;
  }
}

/** Turn one judgment into label changes under the user's policy. Shared by fresh judgments and ones a preview left behind. */
function decide(j: Judgment, policy: PolicyConfig, labels: Record<string, string>): { add: string[]; remove: string[]; actions: string[] } {
  const add: string[] = [];
  const remove: string[] = [];
  const actions: string[] = [];
  const cat = j.category as CategoryId;
  const confident = j.categoryConfidence >= policy.ai.labelConfidence && cat !== "other";
  const labelName = LABEL_BY_CATEGORY[cat];
  if (confident && labelName && labels[labelName]) {
    add.push(labels[labelName], labels[AI_LABEL]);
    actions.push(`label:${labelName}`);
  }
  if (confident && policy.ai.archiveAutomated && j.automated >= policy.ai.archiveAutomatedThreshold && policy.ai.archiveCategories.includes(cat)) {
    remove.push("INBOX");
    actions.push("archive");
  } else if (j.needsAction >= policy.ai.flagActionThreshold && !j.repliedAfter) {
    add.push(labels[ACTION_LABEL]);
    actions.push("flag:action");
  }
  return { add, remove, actions };
}

async function triagePrimary(ctx: {
  gmail: GmailClient; email: string; userId: string; policy: PolicyConfig; labels: Record<string, string>; mode: RunMode; batches: BatchRecord[];
}): Promise<NonNullable<RunSummary["ai"]>> {
  const { gmail, email, userId, policy, labels, mode, batches } = ctx;
  const usage: AiUsage & { labeled: number; archived: number; flaggedAction: number } = {
    messagesConsidered: 0, messagesJudged: 0, cacheHits: 0, requests: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, labeled: 0, archived: 0, flaggedAction: 0,
  };
  const query = `in:inbox category:primary newer_than:${policy.ai.lookbackDays}d -has:userlabels -is:starred -from:me`;
  const candidates = await gmail.listMessageIds(query, policy.ai.maxMessagesPerRun * 3);
  usage.messagesConsidered = candidates.length;
  if (!candidates.length) return usage;

  const existing = await db
    .select({ id: aiJudgments.messageId, threadId: aiJudgments.threadId, judgment: aiJudgments.judgment, actions: aiJudgments.actions })
    .from(aiJudgments)
    .where(and(eq(aiJudgments.userId, userId), inArray(aiJudgments.messageId, candidates)));
  const seen = new Set(existing.map((r) => r.id));
  usage.cacheHits = seen.size;
  // A preview judges but never acts. The next apply finishes that work without asking Jev again.
  const pending = mode === "apply" ? existing.filter((r) => r.actions.length > 0 && r.actions.every((a) => a.startsWith("preview:"))) : [];
  let fresh = candidates.filter((id) => !seen.has(id));
  const affordable = Math.floor(policy.ai.budgetUsdPerRun / estimateCostUsd(1));
  fresh = fresh.slice(0, Math.min(policy.ai.maxMessagesPerRun, affordable));

  type Decision = {
    id: string; threadId: string | null; meta?: GmailMessageMeta; judgment: Judgment; model?: string; inputTokens: number; outputTokens: number;
    add: string[]; remove: string[]; actions: string[]; fromPreview: boolean;
  };
  const decisions: Decision[] = pending.map((r) => ({ id: r.id, threadId: r.threadId, judgment: r.judgment, inputTokens: 0, outputTokens: 0, ...decide(r.judgment, policy, labels), fromPreview: true }));
  const results = await mapLimit(fresh, 6, async (id) => {
    try {
      const meta = await gmail.getMessageMeta(id);
      // Who spoke last is a fact Jev should see: a message the recipient already answered needs no flag.
      const thread = await gmail.getThreadMeta(meta.threadId).then((t) => summarizeThread(t.messages, email)).catch(() => undefined);
      const judgment = await triageMessage(meta, email, thread ? { total: thread.total, lastFromMe: thread.lastFromMe, repliedAfterLatest: thread.repliedAfterLatest, lastInboundAt: thread.lastInboundAt } : undefined);
      return { meta, judgment };
    } catch {
      return null;
    }
  });

  for (const r of results) {
    if (!r) continue;
    const { meta, judgment } = r;
    usage.messagesJudged++;
    usage.requests++;
    usage.inputTokens += judgment.inputTokens;
    usage.outputTokens += judgment.outputTokens;
    usage.model = judgment.model;
    decisions.push({
      id: meta.id, threadId: meta.threadId, meta, judgment: judgment.judgment, model: judgment.model, inputTokens: judgment.inputTokens, outputTokens: judgment.outputTokens,
      ...decide(judgment.judgment, policy, labels), fromPreview: false,
    });
  }
  usage.estimatedCostUsd = usage.inputTokens * USD_PER_INPUT_TOKEN;

  // Group identical label changes into one batchModify each.
  const groups = new Map<string, Decision[]>();
  for (const d of decisions) {
    if (!d.add.length && !d.remove.length) continue;
    const key = `${[...d.add].sort().join(",")}|${[...d.remove].sort().join(",")}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  for (const [, group] of groups) {
    const ids = group.map((d) => d.id);
    const add = group[0].add;
    const remove = group[0].remove;
    if (mode === "apply") {
      await gmail.batchModify(ids, add, remove);
      batches.push({ ruleId: "ai-triage", messageIds: ids, addLabelIds: add, removeLabelIds: remove, restoreLabelIds: remove.includes("INBOX") ? ["INBOX"] : [] });
    }
    for (const d of group) {
      if (d.actions.some((a) => a.startsWith("label:"))) usage.labeled++;
      if (d.actions.includes("archive")) usage.archived++;
      if (d.actions.includes("flag:action")) usage.flaggedAction++;
    }
  }

  const judgedNow = decisions.filter((d) => !d.fromPreview && d.meta);
  if (judgedNow.length) {
    await db.insert(aiJudgments).values(judgedNow.map((d) => ({
      userId, messageId: d.id, threadId: d.threadId,
      from: d.meta!.headers["from"] ?? null, subject: d.meta!.headers["subject"] ?? null,
      receivedAt: d.meta!.internalDate ? new Date(Number(d.meta!.internalDate)) : null,
      judgment: d.judgment, actions: mode === "apply" ? d.actions : d.actions.map((a) => `preview:${a}`),
      model: d.model ?? null, inputTokens: d.inputTokens,
    }))).onConflictDoNothing();
  }
  if (mode === "apply") {
    for (const d of decisions.filter((x) => x.fromPreview)) {
      await db.update(aiJudgments).set({ actions: d.actions }).where(and(eq(aiJudgments.userId, userId), eq(aiJudgments.messageId, d.id)));
    }
  }
  return usage;
}

/** Reverse every batch of a run: remove what it added, restore what it can safely restore. */
export async function undoRun(userId: string, runId: string): Promise<{ batches: number; messages: number; filters: number }> {
  const [run] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, userId))).limit(1);
  if (!run) throw new MailboxError("Run not found");
  if (run.status === "undone") return { batches: 0, messages: 0, filters: 0 };
  const { gmail } = await gmailFor(userId);
  const rows = await db.select().from(runBatches).where(eq(runBatches.runId, runId));
  let messages = 0;
  for (const b of [...rows].reverse()) {
    await gmail.batchModify(b.messageIds, b.restoreLabelIds, b.addLabelIds);
    messages += b.messageIds.length;
  }
  let filters = 0;
  const changes = run.summary?.filters;
  if (changes && (changes.created.length || changes.deleted.length)) {
    const [mb] = await db.select({ managed: mailboxes.managedFilters }).from(mailboxes).where(eq(mailboxes.userId, userId)).limit(1);
    const managed = await undoFilterChanges(gmail, changes, mb?.managed ?? []);
    await db.update(mailboxes).set({ managedFilters: managed, updatedAt: new Date() }).where(eq(mailboxes.userId, userId));
    filters = changes.created.length + changes.deleted.length;
  }
  if (run.summary?.policyBefore) {
    await db.update(mailboxes).set({ policy: run.summary.policyBefore, updatedAt: new Date() }).where(eq(mailboxes.userId, userId));
  }
  await db.update(runs).set({ status: "undone" }).where(eq(runs.id, runId));
  return { batches: rows.length, messages, filters };
}
