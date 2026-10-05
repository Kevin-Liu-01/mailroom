/**
 * Filing operations over a whole mailbox: where Gmail's filters stand against the policy, adopting hand-made filters
 * as routes, syncing filters on demand, and reconciling existing mail with the routes (filters only see new mail).
 * Every change is recorded as a run, so the receipt shows it and Undo reverses it.
 */
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { FilterRecord, RuleResult, RunSummary } from "@/db/schema";
import { mapLimit } from "@/lib/gmail/client";
import { AI_LABEL, type PolicyConfig } from "@/lib/policy/schema";
import { compileRoutes, categoryLabel, formatSenders, namesQuery, planAdoption, planRemovals, routeQuery, senderTokens, type AdoptionItem, type CompiledRoute, type FileCategory, type Route, type RouteConflict } from "@/lib/policy/routes";
import { buildFilters } from "@/lib/policy/rules";
import { ensureSetup, gmailFor, MailboxError } from "./run";
import { criteriaQuery, planSync, toWanted } from "./filters";

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
  manage: boolean;
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
    manage: mb.policy.filing.manage,
    managed: plan.keep.length, wanted: wanted.length, toCreate: mb.policy.filing.manage ? plan.create.length : 0, toRemove: mb.policy.filing.manage ? plan.remove.length : 0,
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
  if (!before.filing.manage) throw new MailboxError("Mailroom is not managing your Gmail filters. Turn that on in Filing first.");
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

/**
 * File one sender into a category from the Senders page: it joins your plain route for that category and leaves your
 * plain routes for any other, then the filters sync. One run records the policy before and the filter changes.
 */
export async function fileSender(userId: string, sender: string, category: FileCategory): Promise<{ runId: string | null; created: number; deleted: number }> {
  const started = Date.now();
  const token = sender.trim().toLowerCase();
  if (!/^[^\s,()"]{3,}$/.test(token)) throw new MailboxError("That does not look like a sender");
  const mb = await loadMailbox(userId);
  const before = mb.policy;
  const plain = (r: Route) => !r.sub && !r.subject && !r.except && !r.star;
  let routes = before.filing.routes.map((r) => (plain(r) && r.category !== category && r.from ? { ...r, from: formatSenders(senderTokens(r.from).filter((t) => t !== token)) || undefined } : r)).filter((r) => r.from || r.subject);
  const home = routes.find((r) => plain(r) && r.category === category);
  if (home) routes = routes.map((r) => (r === home ? { ...r, from: formatSenders([...new Set([...senderTokens(r.from), token])]) } : r));
  else routes = [...routes, { category, from: token }];
  const policy: PolicyConfig = { ...before, filing: { ...before.filing, routes } };
  const { gmail } = await gmailFor(userId);
  const setup = await ensureSetup(gmail, policy, "apply", mb.managedFilters);
  if (setup.errors.length) throw new MailboxError(`Gmail refused ${setup.errors.length}: ${setup.errors.join("; ")}. Nothing was changed.`);
  await db.update(schema.mailboxes).set({ policy, managedFilters: setup.managed, updatedAt: new Date() }).where(eq(schema.mailboxes.userId, userId));
  const n = setup.filters.created.length + setup.filters.deleted.length;
  const runId = await recordRun(userId, {
    rules: [{ id: `file-sender:${token}`, kind: "label", matched: n, applied: n, skipped: `files as ${categoryLabel(category)}` }],
    totalApplied: n, durationMs: Date.now() - started, filters: setup.filters, policyBefore: before,
  }, []);
  return { runId, created: setup.filters.created.length, deleted: setup.filters.deleted.length };
}

/** Filters Mailroom removed or replaced in runs that were not undone, newest first, one per criteria and labels. */
async function retiredFilters(userId: string): Promise<FilterRecord[]> {
  const rows = await db.select({ summary: schema.runs.summary, status: schema.runs.status }).from(schema.runs).where(eq(schema.runs.userId, userId)).orderBy(desc(schema.runs.startedAt)).limit(400);
  const seen = new Set<string>();
  const out: FilterRecord[] = [];
  for (const r of rows) {
    if (r.status === "undone") continue;
    for (const f of r.summary?.filters?.deleted ?? []) {
      const key = JSON.stringify([criteriaQuery(f.criteria), [...(f.action.addLabelIds ?? [])].sort()]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

type Sample = { from: string; subject: string };
export type ReconcileResult = {
  runId: string | null;
  days: number;
  added: { label: string; messages: number }[];
  /** Per label: how many messages lose it, the routes that file them now, most first, and a few examples. */
  removed: { label: string; messages: number; samples: Sample[]; to: { route: string; messages: number }[] }[];
  /** Labels kept because their own route names the sender and only its subject words missed. */
  ambiguous: { label: string; messages: number; samples: Sample[] }[];
};

const quoteLabel = (name: string) => `label:"${name.replace(/"/g, "")}"`;
/** Most messages one reconcile search may return. A search that hits it is incomplete, and is treated that way. */
const SEARCH_CAP = 50000;

/**
 * Filters only file new mail. Reconcile files the last `days` of existing mail the way the routes would today:
 *   add: every message a route claims gets the route's labels;
 *   remove: a label comes off only when a filter Mailroom removed or replaced would have applied it, no current route
 *   of its category claims the message, and a route of another category does. Labels from anywhere else (your own
 *   hand, an old bulk cleanup, Jev) are never touched, nor is mail in Trash.
 * Every decision is a Gmail search, so Gmail evaluates the routes exactly as their filters will. Gmail meters reads
 * far more tightly than searches (about 300 messages a minute), so messages are only read for a few examples.
 * Filing never makes old mail newly eligible for a trash rule: a category that trashes after N days only gains mail
 * younger than N days, so reconciling cannot set off a sweep of old mail at the next run.
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
  const labelName = new Map(allLabels.map((l) => [l.id, l.name]));
  const window = `newer_than:${days}d -in:trash`;
  const a = mb.policy.aging;
  const trashAge: Partial<Record<FileCategory, number | null>> = { security: a.trashSecurityCodesAfterDays, dev: a.trashDevAfterDays, social: a.trashSocialAfterDays, marketing: a.trashMarketingAfterDays };
  const addWindow = (c: FileCategory) => {
    const t = trashAge[c];
    return `newer_than:${t ? Math.max(Math.min(days, t - 1), 1) : days}d -in:trash`;
  };
  const batches: BatchRow[] = [];
  const added = new Map<string, number>();
  const removed = new Map<string, { messages: number; to: Map<string, number>; ids: Map<string, string> }>(); // label -> totals, destination routes, one example id per destination
  const unsure = new Map<string, { messages: number; ids: string[] }>();

  // 1. Add: what each route claims, missing its labels. Several routes can add the same label (a category and its
  //    sub-label routes), so each message counts once per label.
  const adding = new Map<string, Set<string>>();
  for (const r of routes) {
    for (const label of r.labels) {
      const seen = adding.get(label) ?? new Set<string>();
      adding.set(label, seen);
      const ids = (await gmail.listMessageIds(`${routeQuery(r)} ${addWindow(r.category)} -${quoteLabel(label)}`, 5000)).filter((id) => !seen.has(id));
      if (!ids.length) continue;
      for (const id of ids) seen.add(id);
      opts.onProgress?.(`add ${label}: ${ids.length} (${r.name})`);
      added.set(label, (added.get(label) ?? 0) + ids.length);
      if (opts.apply) {
        await gmail.batchModify(ids, [labelId[label]], []);
        batches.push({ ruleId: `reconcile:add:${label}`, messageIds: ids, addLabelIds: [labelId[label]], removeLabelIds: [], restoreLabelIds: [] });
      }
    }
  }

  // 2. Remove: only labels a filter Mailroom removed or replaced would have applied, on mail the routes now file in
  //    another category. Labels from anywhere else (your own hand, an old bulk cleanup, Jev) are never touched.
  const byCategory = new Map<FileCategory, CompiledRoute[]>();
  for (const r of routes) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r]);
  const categoryOf = (id: string): FileCategory | undefined => {
    const name = labelName.get(id);
    if (!name) return undefined;
    return [...byCategory.keys()].find((c) => name === categoryLabel(c) || name.startsWith(`${categoryLabel(c)}/`));
  };
  const retired = await retiredFilters(userId);
  // One search per retired filter and category label: the mail it matches that still carries that label. Gmail lets a
  // filter apply a single user label, so each search pins down exactly which label could be the old filter's doing.
  const jobs: { category: FileCategory; label: string; q: string }[] = [];
  for (const f of retired) {
    const q = criteriaQuery(f.criteria);
    if (!q) continue;
    for (const label of f.action.addLabelIds ?? []) { const category = categoryOf(label); if (category) jobs.push({ category, label, q }); }
  }
  const anyLabel = (ids: string[]) => `(${[...new Set(ids)].map((l) => quoteLabel(labelName.get(l) ?? l)).join(" OR ")})`;
  // A capped search only finds fewer suspects, so fewer labels come off: safe, and the next reconcile finds the rest.
  const found = await mapLimit(jobs, 4, (j) => gmail.listMessageIds(`${j.q} ${window} -${quoteLabel(AI_LABEL)} ${quoteLabel(labelName.get(j.label) ?? j.label)}`, SEARCH_CAP));
  const suspects = new Map<FileCategory, Map<string, Set<string>>>(); // category -> message -> labels on it an old filter could have added
  jobs.forEach((j, i) => {
    if (!found[i].length) return;
    const m = suspects.get(j.category) ?? new Map<string, Set<string>>();
    for (const id of found[i]) m.set(id, new Set([...(m.get(id) ?? []), j.label]));
    suspects.set(j.category, m);
  });
  opts.onProgress?.(`${retired.length} retired filters match ${[...suspects.values()].reduce((n, m) => n + m.size, 0)} labeled messages`);
  const suspectLabels = anyLabel(jobs.map((j) => j.label));
  // What each current route files among those messages, evaluated by Gmail.
  const claimed = suspects.size ? await mapLimit(routes, 4, async (r) => new Set(await gmail.listMessageIds(`${routeQuery(r)} ${window} ${suspectLabels}`, SEARCH_CAP))) : [];
  for (const [category, candidates] of suspects) {
    const parent = categoryLabel(category);
    // If a search for what this category files came back capped, mail it files could look unfiled. Leave it alone.
    if (routes.some((r, i) => r.category === category && claimed[i].size >= SEARCH_CAP)) {
      opts.onProgress?.(`${parent}: too much mail to check in one pass; nothing removed (try fewer days)`);
      continue;
    }
    const here = new Set<string>();
    const elsewhere = new Map<string, string>(); // message -> the route that files it now
    routes.forEach((r, i) => { for (const id of claimed[i]) { if (r.category === category) here.add(id); else if (!elsewhere.has(id)) elsewhere.set(id, r.name); } });
    // Mail a subject-qualified route of this category names by sender stays put, flagged: the qualifier may be incomplete.
    const named = new Set<string>();
    let capped = false;
    for (const r of byCategory.get(category) ?? []) {
      const q = r.subject.length ? namesQuery(r) : "";
      if (!q) continue;
      const ids = await gmail.listMessageIds(`${q} ${window} ${suspectLabels}`, SEARCH_CAP);
      capped ||= ids.length >= SEARCH_CAP;
      for (const id of ids) named.add(id);
    }
    if (capped) {
      opts.onProgress?.(`${parent}: too much mail to check in one pass; nothing removed (try fewer days)`);
      continue;
    }
    const plan = planRemovals(candidates, here, new Set(elsewhere.keys()), named);
    opts.onProgress?.(`${parent}: ${candidates.size} could be an old filter's; ${plan.strip.size} filed elsewhere now, ${plan.ambiguous.size} kept as ambiguous`);
    const groups = new Map<string, string[]>();
    for (const [id, strip] of plan.strip) groups.set(strip.join(","), [...(groups.get(strip.join(",")) ?? []), id]);
    for (const [key, ids] of groups) {
      const strip = key.split(",");
      for (const l of strip) {
        const name = labelName.get(l) ?? l;
        const entry = removed.get(name) ?? { messages: 0, to: new Map<string, number>(), ids: new Map<string, string>() };
        entry.messages += ids.length;
        for (const id of ids) {
          const route = elsewhere.get(id) ?? "";
          entry.to.set(route, (entry.to.get(route) ?? 0) + 1);
          if (!entry.ids.has(route)) entry.ids.set(route, id);
        }
        removed.set(name, entry);
      }
      opts.onProgress?.(`remove ${strip.map((l) => labelName.get(l) ?? l).join(" + ")}: ${ids.length}`);
      if (opts.apply) {
        await gmail.batchModify(ids, [], strip);
        batches.push({ ruleId: `reconcile:remove:${parent}`, messageIds: ids, addLabelIds: [], removeLabelIds: strip, restoreLabelIds: strip });
      }
    }
    for (const [id, labels] of plan.ambiguous) {
      for (const l of labels) {
        const name = labelName.get(l) ?? l;
        const entry = unsure.get(name) ?? { messages: 0, ids: [] };
        entry.messages++;
        if (entry.ids.length < 3) entry.ids.push(id);
        unsure.set(name, entry);
      }
    }
  }

  // A few examples per label, one per destination route first: the only messages reconcile reads.
  const sampleIds = new Set<string>();
  for (const e of removed.values()) for (const [, id] of [...e.ids].sort((x, y) => (e.to.get(y[0]) ?? 0) - (e.to.get(x[0]) ?? 0)).slice(0, 3)) sampleIds.add(id);
  for (const e of unsure.values()) for (const id of e.ids) sampleIds.add(id);
  const metas = new Map((await mapLimit([...sampleIds], 4, (id) => gmail.getMessageMeta(id, ["From", "Subject"]).catch(() => null))).filter((m): m is NonNullable<typeof m> => Boolean(m)).map((m) => [m.id, m]));
  const sample = (id: string): Sample | null => {
    const m = metas.get(id);
    if (!m) return null;
    const from = m.headers["from"] ?? "";
    return { from: from.replace(/\s*<[^>]+>/, "").replace(/"/g, "") || from, subject: (m.headers["subject"] ?? "").slice(0, 90) };
  };
  const samplesOf = (ids: string[]) => ids.map(sample).filter((x): x is Sample => Boolean(x));

  const result: ReconcileResult = {
    runId: null, days,
    added: [...added].map(([label, messages]) => ({ label, messages })).sort((x, y) => y.messages - x.messages),
    removed: [...removed].map(([label, e]) => ({
      label, messages: e.messages,
      samples: samplesOf([...e.ids].sort((x, y) => (e.to.get(y[0]) ?? 0) - (e.to.get(x[0]) ?? 0)).slice(0, 3).map(([, id]) => id)),
      to: [...e.to].map(([route, messages]) => ({ route, messages })).sort((x, y) => y.messages - x.messages),
    })).sort((x, y) => y.messages - x.messages),
    ambiguous: [...unsure].map(([label, e]) => ({ label, messages: e.messages, samples: samplesOf(e.ids) })).sort((x, y) => y.messages - x.messages),
  };
  if (opts.apply && batches.length) {
    const total = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
    const rules: RuleResult[] = [
      { id: "reconcile-add", kind: "label", matched: total([...added.values()]), applied: total([...added.values()]) },
      { id: "reconcile-remove", kind: "label", matched: total([...removed.values()].map((e) => e.messages)), applied: total([...removed.values()].map((e) => e.messages)) },
    ];
    result.runId = await recordRun(userId, { rules, totalApplied: rules[0].applied + rules[1].applied, durationMs: Date.now() - started }, batches);
  }
  return result;
}

export type { FilterRecord };
