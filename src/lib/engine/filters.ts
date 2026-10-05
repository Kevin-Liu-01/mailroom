/**
 * Gmail filter sync. Mailroom owns the filters it created (their ids live on the mailbox) and the filters older
 * versions created (recognised by their exact criteria). Everything else in Gmail is the user's and is left alone.
 * New filters are created before stale ones are deleted, so mail is never unfiled mid-sync, and every change is
 * returned as a record that undo can reverse.
 */
import type { FilterRecord } from "@/db/schema";
import type { GmailClient, GmailFilter, GmailFilterAction, GmailFilterCriteria } from "@/lib/gmail/client";
import type { FilterSpec } from "@/lib/policy/rules";
import { isRetired } from "@/lib/policy/routes";

export type WantedFilter = { spec: FilterSpec; criteria: GmailFilterCriteria; action: GmailFilterAction };
export type SyncPlan = { keep: { wanted: WantedFilter; filter: GmailFilter }[]; create: WantedFilter[]; remove: GmailFilter[] };

const CRITERIA_KEYS = ["from", "to", "subject", "query", "negatedQuery", "hasAttachment", "size", "sizeComparison", "excludeChats"] as const;
const norm = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().toLowerCase() : v === undefined || v === null || v === false ? "" : String(v));
const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

export function sameCriteria(a: GmailFilterCriteria, b: GmailFilterCriteria): boolean {
  return CRITERIA_KEYS.every((k) => norm(a[k]) === norm(b[k]));
}
export function sameAction(a: GmailFilterAction, b: GmailFilterAction): boolean {
  return sameSet(a.addLabelIds, b.addLabelIds) && sameSet(a.removeLabelIds, b.removeLabelIds) && norm(a.forward) === norm(b.forward);
}

/** Resolve a spec's label names to ids. System labels (IMPORTANT, STARRED, INBOX) pass through. */
export function toWanted(spec: FilterSpec, labels: Record<string, string>): WantedFilter {
  const criteria: GmailFilterCriteria = {};
  if (spec.criteria.from) criteria.from = spec.criteria.from;
  if (spec.criteria.subject) criteria.subject = spec.criteria.subject;
  if (spec.criteria.negatedQuery) criteria.negatedQuery = spec.criteria.negatedQuery;
  const action: GmailFilterAction = {};
  const add = spec.action.addLabelNames.map((n) => labels[n] ?? n);
  if (add.length) action.addLabelIds = add;
  if (spec.action.removeLabelIds.length) action.removeLabelIds = spec.action.removeLabelIds;
  return { spec, criteria, action };
}

/** What has to change for Gmail to hold exactly the wanted filters, touching only filters Mailroom owns. */
export function planSync(wanted: WantedFilter[], existing: GmailFilter[], managed: Set<string>): SyncPlan {
  const used = new Set<string>();
  const keep: SyncPlan["keep"] = [];
  const create: WantedFilter[] = [];
  // Prefer keeping a filter Mailroom already owns; an identical hand-made one is adopted as is.
  const ordered = [...existing].sort((a, b) => Number(managed.has(b.id)) - Number(managed.has(a.id)));
  for (const w of wanted) {
    const hit = ordered.find((f) => !used.has(f.id) && sameCriteria(f.criteria, w.criteria) && sameAction(f.action, w.action));
    if (hit) { used.add(hit.id); keep.push({ wanted: w, filter: hit }); } else create.push(w);
  }
  const remove = existing.filter((f) => !used.has(f.id) && (managed.has(f.id) || isRetired(f.criteria as Record<string, unknown>)));
  return { keep, create, remove };
}

const record = (f: GmailFilter, managed: boolean, name?: string): FilterRecord => ({ id: f.id, criteria: { ...f.criteria }, action: { ...f.action }, managed, name });

/**
 * Apply a plan. Returns the ids Mailroom now owns, the records undo needs, and any errors. Creation never stops early,
 * so every filter that was made is recorded; if any creation failed, nothing is deleted, so mail is never left unfiled.
 */
export async function applySync(gmail: GmailClient, plan: SyncPlan, managed: Set<string>): Promise<{ managed: string[]; created: FilterRecord[]; deleted: FilterRecord[]; errors: string[] }> {
  const owned = new Set([...plan.keep.map((k) => k.filter.id), ...[...managed].filter((id) => !plan.remove.some((f) => f.id === id))]);
  const created: FilterRecord[] = [];
  const deleted: FilterRecord[] = [];
  const errors: string[] = [];
  for (const w of plan.create) {
    try {
      const f = await gmail.createFilter(w.criteria, w.action);
      owned.add(f.id);
      created.push(record(f, true, w.spec.name));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Gmail refuses an exact duplicate. Find the twin and own it instead.
      const twin = /already exists/i.test(message) ? (await gmail.listFilters()).find((f) => sameCriteria(f.criteria, w.criteria) && sameAction(f.action, w.action)) : undefined;
      if (twin) owned.add(twin.id);
      else errors.push(`${w.spec.name}: ${message.match(/"message":\s*"([^"]+)"/)?.[1] ?? message.slice(0, 160)}`);
    }
  }
  if (!errors.length) {
    for (const f of plan.remove) {
      await gmail.deleteFilter(f.id);
      deleted.push(record(f, managed.has(f.id)));
      owned.delete(f.id);
    }
  }
  return { managed: [...owned], created, deleted, errors };
}

/** Reverse a run's filter changes: remove what it created, recreate what it removed. Returns the new owned set. */
export async function undoFilterChanges(gmail: GmailClient, changes: { created: FilterRecord[]; deleted: FilterRecord[] }, managed: string[]): Promise<string[]> {
  const owned = new Set(managed);
  for (const c of [...changes.created].reverse()) {
    await gmail.deleteFilter(c.id);
    owned.delete(c.id);
  }
  for (const d of changes.deleted) {
    try {
      const f = await gmail.createFilter(d.criteria as GmailFilterCriteria, d.action);
      if (d.managed) owned.add(f.id);
    } catch (err) {
      if (!(err instanceof Error && /already exists/i.test(err.message))) throw err;
    }
  }
  return [...owned];
}
