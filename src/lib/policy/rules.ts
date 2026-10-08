import { CATEGORY_IDS, LABEL_BY_CATEGORY, type CategoryId, type PolicyConfig } from "./schema";
import { compileRoutes, type CompiledRoute } from "./routes";

export type Rule = {
  id: string;
  kind: "archive" | "trash" | "read" | "importance";
  query: string;
  addLabelIds: string[];
  removeLabelIds: string[];
  /** Human explanation shown in the UI and receipts. */
  why: string;
};

export type LabelMap = Record<string, string>; // label name -> Gmail label id

const q = (label: string) => `label:"${label}"`;
const orLabels = (labels: string[]) => "(" + labels.map(q).join(" OR ") + ")";

function labelsFor(ids: CategoryId[]): string[] {
  return ids.map((id) => LABEL_BY_CATEGORY[id]).filter((l): l is string => Boolean(l));
}

/** People whose mail no rule archives or trashes: the senders you protect, family, and work. */
function peopleGuard(policy: PolicyConfig): string {
  const people = [...new Set([...policy.senders.protected, ...policy.senders.family, ...policy.senders.work])];
  return people.length ? ` -from:(${people.join(" OR ")})` : "";
}

/**
 * Build the deterministic rule set for a policy. Every rule is a Gmail search plus a label change,
 * which is exactly what Gmail's batchModify needs and what a human can re-run by hand to verify.
 * Trash means Gmail Trash (30-day recovery). Nothing here deletes permanently.
 */
export function buildRules(policy: PolicyConfig): Rule[] {
  const rules: Rule[] = [];
  const a = policy.aging;
  const protectedLabels = new Set(labelsFor(policy.categories.protected));
  // A trash rule never touches mail you sent, mail that also carries a protected label, or mail from people you named.
  const trashGuard = ` -in:sent${[...protectedLabels].map((l) => ` -${q(l)}`).join("")}${peopleGuard(policy)}`;

  for (const label of labelsFor(policy.categories.skipInbox)) {
    rules.push({
      id: `archive-stragglers:${label}`,
      kind: "archive",
      query: `in:inbox ${q(label)} older_than:${a.archiveStragglersAfterDays}d${peopleGuard(policy)}`,
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
      why: `${label} mail leaves the inbox after ${a.archiveStragglersAfterDays} days if a filter missed it.`,
    });
  }

  const trash = (id: string, labels: string[], days: number | null, why: string) => {
    if (days === null || labels.length === 0) return;
    const blocked = labels.filter((l) => protectedLabels.has(l));
    if (blocked.length) return; // never build a trash rule that names a protected label
    rules.push({
      id,
      kind: "trash",
      query: `${labels.length === 1 ? q(labels[0]) : orLabels(labels)} older_than:${days}d -in:trash -is:starred${trashGuard}`,
      addLabelIds: ["TRASH"],
      removeLabelIds: ["INBOX", "UNREAD"],
      why,
    });
  };
  trash("trash-security-codes", labelsFor(["security"]), a.trashSecurityCodesAfterDays, `Verification codes and sign-in alerts expire; trash after ${a.trashSecurityCodesAfterDays} days.`);
  trash("trash-dev-notices", labelsFor(["dev"]), a.trashDevAfterDays, `Old CI and deploy notifications are noise; trash after ${a.trashDevAfterDays} days.`);
  trash("trash-social-notices", labelsFor(["social"]), a.trashSocialAfterDays, `Old social notifications are noise; trash after ${a.trashSocialAfterDays} days.`);
  trash("trash-old-marketing", labelsFor(["marketing"]), a.trashMarketingAfterDays, `Promotions older than ${a.trashMarketingAfterDays} days.`);

  const read = (id: string, query: string, days: number | null, why: string) => {
    if (days === null) return;
    rules.push({ id, kind: "read", query: `${query} is:unread older_than:${days}d -in:trash`, addLabelIds: [], removeLabelIds: ["UNREAD"], why });
  };
  read("mark-read-old-promotions", "category:promotions", a.markReadPromotionsAfterDays, "Unread promotions stop counting against the unread badge after two weeks.");
  read("mark-read-old-social", "category:social", a.markReadSocialAfterDays, "Unread social notifications stop counting after two weeks.");
  read("mark-read-old-updates", "category:updates", a.markReadUpdatesAfterDays, "Unread automated updates stop counting after a month.");

  for (const [domain, days] of Object.entries(policy.senders.trashAfterDays)) {
    if (policy.senders.protected.includes(domain)) continue;
    rules.push({
      id: `trash-sender:${domain}`,
      kind: "trash",
      query: `from:${domain} older_than:${days}d -in:trash -is:starred${trashGuard}`,
      addLabelIds: ["TRASH"],
      removeLabelIds: ["INBOX", "UNREAD"],
      why: `You decided mail from ${domain} is disposable after ${days} days.`,
    });
  }
  if (policy.senders.heavyPromo.length) {
    rules.push({
      id: "demote-heavy-promos",
      kind: "importance",
      query: `from:(${policy.senders.heavyPromo.join(" OR ")}) is:important -in:trash`,
      addLabelIds: [],
      removeLabelIds: ["IMPORTANT"],
      why: "Heavy promotional senders never count as important, so they stop surfacing above real mail.",
    });
  }
  return rules;
}

/** Resolve rule label names to ids once the mailbox labels exist. */
export function resolveRule(rule: Rule, labels: LabelMap): Rule {
  const resolve = (ids: string[]) => ids.map((id) => labels[id] ?? id);
  return { ...rule, addLabelIds: resolve(rule.addLabelIds), removeLabelIds: resolve(rule.removeLabelIds) };
}

/** The Gmail filters this policy wants to exist, expressed as (criteria, action) pairs. */
export type FilterSpec = {
  id: string;
  name: string;
  origin: CompiledRoute["origin"];
  criteria: { from?: string; subject?: string; negatedQuery?: string };
  action: { addLabelNames: string[]; removeLabelIds: string[] };
};

/**
 * Gmail filters for a policy's routes, with every overlap resolved (see routes.ts). Gmail lets a filter apply only one
 * user label, so a route with a sub-label becomes two filters with the same criteria: one files into the category
 * (and carries the inbox and importance actions), the other adds the sub-label.
 */
export function buildFilters(policy: PolicyConfig): FilterSpec[] {
  return compileRoutes(policy).routes.flatMap((r) => {
    const [parent, child] = r.labels;
    const main: FilterSpec = { id: r.id, name: r.name, origin: r.origin, criteria: r.criteria, action: { addLabelNames: [parent, ...r.addSystem], removeLabelIds: r.removeSystem } };
    return child ? [main, { id: `${r.id}:sub`, name: r.name, origin: r.origin, criteria: r.criteria, action: { addLabelNames: [child], removeLabelIds: [] } }] : [main];
  });
}

export const ALL_TAXONOMY_LABELS = CATEGORY_IDS.map((id) => LABEL_BY_CATEGORY[id]).filter((l): l is string => Boolean(l));
