/**
 * Filing operations over a whole mailbox: where Gmail's filters stand against the policy, adopting hand-made filters
 * as routes, syncing filters on demand, and reconciling existing mail with the routes (filters only see new mail).
 * Every change is recorded as a run, so the receipt shows it and Undo reverses it.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { FilterRecord, RuleResult, RunSummary } from "@/db/schema";
import { mapLimit } from "@/lib/gmail/client";
import { AI_LABEL, type PolicyConfig } from "@/lib/policy/schema";
import { compileRoutes, categoryLabel, planAdoption, routeClaims, routeQuery, type AdoptionItem, type CompiledRoute, type FileCategory, type RouteConflict } from "@/lib/policy/routes";
import { buildFilters } from "@/lib/policy/rules";
import { ensureSetup, gmailFor, MailboxError } from "./run";
import { planSync, toWanted } from "./filters";

type BatchRow = { ruleId: string; messageIds: string[]; addLabelIds: string[]; removeLabelIds: string[]; restoreLabelIds: string[] };

async function loadMailbox(userId: string) {
  const [mb] = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.userId, userId)).limit(1);
  if (!mb) throw new MailboxError("Mailbox is not set up");
  return mb;
}

async function recordRun(userId: string, summary: RunSummary, batches: BatchRow[], mode: "apply" | "dry-run" = "apply"): Promise<string> {
  const [run] = await db.insert(schema.runs).values({ userId, mode, trigger: "manual", status: "ok", summary, finishedAt: new Date() }).returning({ id: schema.runs.id });
  if (batches.length) await db.insert(schema.runBatches).values(batches.map((b) => ({ runId: run.id, ...b })));
  return run.id;
}

export type FilterStatus = {
  managed: number;
  wanted: number;
  toCreate: number;
  toRemove: number;
  adoptable: AdoptionItem[];
  kept: AdoptionItem[];
  conflicts: RouteConflict[];
};

/** Where Gmail's filters stand against the policy: drift to sync, hand-made filters to adopt, and conflicts. */
export async function filterStatus(userId: string): Promise<FilterStatus> {
  const mb = await loadMailbox(userId);
  const { gmail } = await gmailFor(userId);
  const [labels, filters] = await Promise.all([gmail.listLabels(), gmail.listFilters()]);
  const byName = Object.fromEntries(labels.map((l) => [l.name, l.id]));
  const byId = new Map(labels.map((l) => [l.id, l.name]));
  const managed = new Set(mb.managedFilters);
  const wanted = buildFilters(mb.policy).map((s) => toWanted(s, byName));
  const plan = planSync(wanted, filters, managed);
  const ours = new Set([...plan.keep.map((k) => k.filter.id), ...plan.remove.map((f) => f.id), ...managed]);
  const adoption = planAdoption(filters, (id) => byId.get(id), mb.policy, ours);
  return {
    managed: plan.keep.length, wanted: wanted.length, toCreate: plan.create.length, toRemove: plan.remove.length,
    adoptable: adoption.adopt, kept: adoption.keep, conflicts: compileRoutes(mb.policy).conflicts,
  };
}

/** Bring Gmail's filters in line with the policy now, without running the rules. */
export async function syncFiltersNow(userId: string): Promise<{ runId: string | null; created: number; deleted: number }> {
  const mb = await loadMailbox(userId);
  const { gmail } = await gmailFor(userId);
  const setup = await ensureSetup(gmail, mb.policy, "apply", mb.managedFilters);
  await db.update(schema.mailboxes).set({ managedFilters: setup.managed, labelsReady: true, updatedAt: new Date() }).where(eq(schema.mailboxes.userId, userId));
  const n = setup.filters.created.length + setup.filters.deleted.length;
  const error = setup.errors.length ? `Gmail refused ${setup.errors.length}: ${setup.errors.join("; ")}. Nothing was removed.` : undefined;
  if (!n && !error) return { runId: null, created: 0, deleted: 0 };
  const runId = await recordRun(userId, {
    rules: [{ id: "sync-filters", kind: "label", matched: n, applied: n, ...(error ? { error } : {}) }], totalApplied: n, durationMs: 0, filters: setup.filters,
  }, []);
  if (error) throw new MailboxError(error);
  return { runId, created: setup.filters.created.length, deleted: setup.filters.deleted.length };
}

/**
 * Adopt hand-made filters: their senders become routes in the policy, Mailroom creates its own filters for them, and
 * only then are the originals removed. One run records all of it, including the policy before, so Undo restores both.
 */
export async function adoptFilters(userId: string): Promise<{ runId: string | null; adopted: number; created: number; deleted: number; kept: number }> {
  const started = Date.now();
  const mb = await loadMailbox(userId);
  const { gmail } = await gmailFor(userId);
  const [labels, filters] = await Promise.all([gmail.listLabels(), gmail.listFilters()]);
  const byName = Object.fromEntries(labels.map((l) => [l.name, l.id]));
  const byId = new Map(labels.map((l) => [l.id, l.name]));
  const managed = new Set(mb.managedFilters);
  const before = mb.policy;
  const current = planSync(buildFilters(before).map((s) => toWanted(s, byName)), filters, managed);
  const ours = new Set([...current.keep.map((k) => k.filter.id), ...current.remove.map((f) => f.id), ...managed]);
  const plan = planAdoption(filters, (id) => byId.get(id), before, ours);
  if (!plan.adopt.length) return { runId: null, adopted: 0, created: 0, deleted: 0, kept: plan.keep.length };

  const policy: PolicyConfig = { ...before, filing: { ...before.filing, routes: plan.routes } };
  const setup = await ensureSetup(gmail, policy, "apply", mb.managedFilters);
  if (setup.errors.length) {
    // Keep the policy and every hand-made filter as they were; record what was created so Undo can take it back.
    const error = `Gmail refused ${setup.errors.length} filters: ${setup.errors.join("; ")}. Your filters and policy are unchanged.`;
    await db.update(schema.mailboxes).set({ managedFilters: setup.managed, updatedAt: new Date() }).where(eq(schema.mailboxes.userId, userId));
    await recordRun(userId, { rules: [{ id: "adopt-filters", kind: "label", matched: plan.adopt.length, applied: 0, error }], totalApplied: setup.filters.created.length, durationMs: Date.now() - started, filters: setup.filters }, []);
    throw new MailboxError(error);
  }
  const created = [...setup.filters.created];
  const deleted = [...setup.filters.deleted];
  const owned = new Set(setup.managed);
  for (const item of plan.adopt) {
    if (owned.has(item.id)) continue; // identical to a wanted filter: it is Mailroom's now, keep it
    const f = filters.find((x) => x.id === item.id);
    if (!f) continue;
    await gmail.deleteFilter(f.id);
    deleted.push({ id: f.id, criteria: { ...f.criteria }, action: { ...f.action }, managed: false, name: item.labels.join(", ") });
  }
  await db.update(schema.mailboxes).set({ policy, managedFilters: [...owned], labelsReady: true, updatedAt: new Date() }).where(eq(schema.mailboxes.userId, userId));
  const runId = await recordRun(userId, {
    rules: [{ id: "adopt-filters", kind: "label", matched: plan.adopt.length, applied: plan.adopt.length, skipped: `${plan.keep.length} of your filters left alone` }],
    totalApplied: created.length + deleted.length, durationMs: Date.now() - started,
    filters: { created, deleted }, policyBefore: before,
  }, []);
  return { runId, adopted: plan.adopt.length, created: created.length, deleted: deleted.length, kept: plan.keep.length };
}

export type ReconcileResult = {
  runId: string | null;
  days: number;
  added: { label: string; messages: number }[];
  removed: { label: string; messages: number }[];
};

const quoteLabel = (name: string) => `label:"${name.replace(/"/g, "")}"`;

/**
 * Filters only file new mail. Reconcile files the last `days` of existing mail the way the routes would today:
 *   add: every message a route claims gets the route's labels;
 *   remove: a category label comes off a message when a route of another category claims it and no route of its own
 *   category does. Mail Jev labeled ("Mailroom/AI Sorted") and mail in Trash are never touched.
 */
export async function reconcileMail(userId: string, opts: { days: number; apply: boolean; onProgress?: (msg: string) => void }): Promise<ReconcileResult> {
  const started = Date.now();
  const days = Math.min(Math.max(Math.round(opts.days), 1), 3650);
  const mb = await loadMailbox(userId);
  const { gmail } = await gmailFor(userId);
  const { routes } = compileRoutes(mb.policy);
  const setup = await ensureSetup(gmail, mb.policy, "dry-run", mb.managedFilters); // makes sure every route label exists
  const labelId = setup.labels;
  const allLabels = await gmail.listLabels();
  const window = `newer_than:${days}d -in:trash`;
  const batches: BatchRow[] = [];
  const added = new Map<string, number>();
  const removed = new Map<string, number>();

  // 1. Add: what each route claims, missing its labels.
  for (const r of routes) {
    for (const label of r.labels) {
      const ids = await gmail.listMessageIds(`${routeQuery(r)} ${window} -${quoteLabel(label)}`, 5000);
      if (!ids.length) continue;
      opts.onProgress?.(`add ${label}: ${ids.length} (${r.name})`);
      added.set(label, (added.get(label) ?? 0) + ids.length);
      if (opts.apply) {
        await gmail.batchModify(ids, [labelId[label]], []);
        batches.push({ ruleId: `reconcile:add:${label}`, messageIds: ids, addLabelIds: [labelId[label]], removeLabelIds: [], restoreLabelIds: [] });
      }
    }
  }

  // 2. Remove: category labels the routes now give to another category.
  const byCategory = new Map<FileCategory, CompiledRoute[]>();
  for (const r of routes) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r]);
  for (const [category, own] of byCategory) {
    const parent = categoryLabel(category);
    const family = allLabels.filter((l) => l.name === parent || l.name.startsWith(`${parent}/`));
    if (!family.length) continue;
    const others = routes.filter((r) => r.category !== category);
    const tokens = [...new Set(others.flatMap((r) => r.senders))];
    const labelExpr = `(${family.map((l) => quoteLabel(l.name)).join(" OR ")})`;
    const candidates = new Set<string>();
    for (let i = 0; i < tokens.length; i += 25) {
      const chunk = tokens.slice(i, i + 25);
      for (const id of await gmail.listMessageIds(`${labelExpr} ${window} -${quoteLabel(AI_LABEL)} from:(${chunk.join(" OR ")})`, 5000)) candidates.add(id);
    }
    if (!candidates.size) continue;
    const metas = await mapLimit([...candidates], 4, (id) => gmail.getMessageMeta(id, ["From", "Subject"]).catch(() => null));
    const familyIds = new Set(family.map((l) => l.id));
    const groups = new Map<string, string[]>();
    for (const m of metas) {
      if (!m) continue;
      const from = m.headers["from"] ?? "", subject = m.headers["subject"] ?? "";
      if (own.some((r) => routeClaims(r, from, subject)) || !others.some((r) => routeClaims(r, from, subject))) continue;
      const strip = m.labelIds.filter((l) => familyIds.has(l)).sort();
      if (!strip.length) continue;
      const key = strip.join(",");
      groups.set(key, [...(groups.get(key) ?? []), m.id]);
    }
    for (const [key, ids] of groups) {
      const strip = key.split(",");
      opts.onProgress?.(`remove ${parent}: ${ids.length}`);
      for (const l of strip) { const name = family.find((f) => f.id === l)?.name ?? l; removed.set(name, (removed.get(name) ?? 0) + ids.length); }
      if (opts.apply) {
        await gmail.batchModify(ids, [], strip);
        batches.push({ ruleId: `reconcile:remove:${parent}`, messageIds: ids, addLabelIds: [], removeLabelIds: strip, restoreLabelIds: strip });
      }
    }
  }

  const toList = (m: Map<string, number>) => [...m].map(([label, messages]) => ({ label, messages })).sort((a, b) => b.messages - a.messages);
  const result: ReconcileResult = { runId: null, days, added: toList(added), removed: toList(removed) };
  if (opts.apply && batches.length) {
    const rules: RuleResult[] = [
      { id: "reconcile-add", kind: "label", matched: [...added.values()].reduce((a, b) => a + b, 0), applied: [...added.values()].reduce((a, b) => a + b, 0) },
      { id: "reconcile-remove", kind: "label", matched: [...removed.values()].reduce((a, b) => a + b, 0), applied: [...removed.values()].reduce((a, b) => a + b, 0) },
    ];
    result.runId = await recordRun(userId, { rules, totalApplied: rules[0].applied + rules[1].applied, durationMs: Date.now() - started }, batches);
  }
  return result;
}

export type { FilterRecord };
