import { CATEGORY_IDS, LABEL_BY_CATEGORY, type CategoryId, type PolicyConfig } from "./schema";

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

/**
 * Build the deterministic rule set for a policy. Every rule is a Gmail search plus a label change,
 * which is exactly what Gmail's batchModify needs and what a human can re-run by hand to verify.
 * Trash means Gmail Trash (30-day recovery). Nothing here deletes permanently.
 */
export function buildRules(policy: PolicyConfig): Rule[] {
  const rules: Rule[] = [];
  const a = policy.aging;
  const protectedLabels = new Set(labelsFor(policy.categories.protected));

  for (const label of labelsFor(policy.categories.skipInbox)) {
    rules.push({
      id: `archive-stragglers:${label}`,
      kind: "archive",
      query: `in:inbox ${q(label)} older_than:${a.archiveStragglersAfterDays}d`,
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
      query: `${labels.length === 1 ? q(labels[0]) : orLabels(labels)} older_than:${days}d -in:trash -is:starred`,
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
  criteria: { from?: string; subject?: string; query?: string };
  action: { addLabelNames: string[]; removeLabelIds: string[] };
};

const SUBJECT_SECURITY =
  '"verification code" OR "security code" OR "one-time" OR "verify your email" OR "confirm your email" OR "sign-in attempt" OR "new sign-in" OR "login code" OR "password reset" OR "2-step" OR "two-factor" OR "your code is" OR "authentication code" OR "single-use code" OR "temporary password"';

export function buildFilters(policy: PolicyConfig): FilterSpec[] {
  const specs: FilterSpec[] = [];
  const never = new Set(policy.categories.neverImportant);
  const skip = new Set(policy.categories.skipInbox);
  const remove = (cat: CategoryId) => [
    ...(skip.has(cat) ? ["INBOX"] : []),
    ...(never.has(cat) ? ["IMPORTANT"] : []),
  ];
  const label = (cat: CategoryId) => LABEL_BY_CATEGORY[cat] as string;

  specs.push({ id: "security-codes", criteria: { subject: SUBJECT_SECURITY }, action: { addLabelNames: [label("security")], removeLabelIds: remove("security") } });
  specs.push({ id: "dev-vercel", criteria: { from: "notifications@vercel.com OR invoice+statements@vercel.com OR ship@info.vercel.com" }, action: { addLabelNames: [label("dev")], removeLabelIds: remove("dev") } });
  specs.push({ id: "dev-github", criteria: { from: "notifications@github.com OR noreply@github.com OR support@github.com" }, action: { addLabelNames: [label("dev")], removeLabelIds: remove("dev") } });
  specs.push({ id: "dev-other", criteria: { from: "sentry.io OR supabase.com OR supabase.io OR cloudflare.com OR netlify.com OR npmjs.com OR circleci.com OR travis-ci.com OR render.com OR railway.app OR fly.io OR planetscale.com OR neon.tech OR datadoghq.com OR pagerduty.com OR linear.app OR atlassian.net OR jira.com" }, action: { addLabelNames: [label("dev")], removeLabelIds: remove("dev") } });
  specs.push({ id: "social", criteria: { from: "linkedin.com OR nextdoor.com OR instagram.com OR facebook.com OR facebookmail.com OR twitter.com OR x.com OR youtube.com OR discord.com OR reddit.com OR redditmail.com OR tiktok.com OR pinterest.com OR snapchat.com OR threads.net OR quora.com OR medium.com" }, action: { addLabelNames: [label("social")], removeLabelIds: remove("social") } });
  specs.push({ id: "receipts", criteria: { from: "uber.com OR doordash.com OR auto-confirm@amazon.com OR shipment-tracking@amazon.com OR order-update@amazon.com OR no_reply@email.apple.com OR grubhub.com OR lyft.com OR instacart.com OR ubereats.com", subject: "receipt OR order OR delivered OR shipped OR \"your trip\" OR confirmation OR invoice" }, action: { addLabelNames: [label("receipts")], removeLabelIds: remove("receipts") } });
  specs.push({ id: "newsletters", criteria: { from: "tldrnewsletter.com OR substack.com OR beehiiv.com OR morningbrew.com OR theinformation.com OR nytimes.com OR email.cnn.com OR newsletters.cnn.com OR bloomberg.com OR economist.com OR axios.com OR every.to OR convertkit.com OR mailchimp.com OR buttondown.email" }, action: { addLabelNames: [label("newsletters")], removeLabelIds: remove("newsletters") } });
  specs.push({ id: "finance", criteria: { from: "chase.com OR bankofamerica.com OR wellsfargo.com OR tdbank.com OR capitalone.com OR amex.com OR americanexpress.com OR discover.com OR citi.com OR robinhood.com OR wealthfront.com OR wealthfrontmail.com OR fidelity.com OR schwab.com OR vanguard.com OR experian.com OR creditkarma.com OR mint.com OR venmo.com OR paypal.com OR zellepay.com OR irs.gov OR turbotax.intuit.com OR stripe.com OR mercury.com OR brex.com" }, action: { addLabelNames: [label("finance")], removeLabelIds: remove("finance") } });
  specs.push({ id: "travel", criteria: { from: "united.com OR delta.com OR aa.com OR southwest.com OR jetblue.com OR alaskaair.com OR amtrak.com OR marriott.com OR hilton.com OR hyatt.com OR airbnb.com OR booking.com OR expedia.com OR hotels.com OR kayak.com OR tripit.com OR hertz.com OR avis.com OR enterprise.com" }, action: { addLabelNames: [label("travel")], removeLabelIds: remove("travel") } });
  specs.push({ id: "events", criteria: { from: "luma.com OR luma-mail.com OR lu.ma OR eventbrite.com OR meetup.com OR partiful.com OR ticketmaster.com OR axs.com OR dice.fm OR splashthat.com OR calendar-notification@google.com" }, action: { addLabelNames: [label("events")], removeLabelIds: remove("events") } });
  specs.push({ id: "events-invitations", criteria: { subject: '"Invitation:" OR "Updated invitation" OR "Accepted:" OR "Declined:" OR "Invitation from an unknown sender"' }, action: { addLabelNames: [label("events")], removeLabelIds: remove("events") } });
  specs.push({ id: "recruiting", criteria: { from: "greenhouse.io OR lever.co OR ashbyhq.com OR workday.com OR myworkday.com OR smartrecruiters.com OR icims.com OR jobvite.com OR hired.com OR wellfound.com OR angel.co OR indeed.com OR glassdoor.com OR ziprecruiter.com OR triplebyte.com OR otta.com OR simplify.jobs" }, action: { addLabelNames: [label("recruiting")], removeLabelIds: remove("recruiting") } });
  if (policy.senders.heavyPromo.length) {
    specs.push({ id: "heavy-promo", criteria: { from: policy.senders.heavyPromo.join(" OR ") }, action: { addLabelNames: [label("marketing")], removeLabelIds: ["IMPORTANT"] } });
  }
  if (policy.senders.work.length) {
    specs.push({ id: "work", criteria: { from: policy.senders.work.join(" OR ") }, action: { addLabelNames: [label("work"), "IMPORTANT"], removeLabelIds: [] } });
  }
  if (policy.senders.family.length) {
    specs.push({ id: "family", criteria: { from: policy.senders.family.join(" OR ") }, action: { addLabelNames: [label("personal"), "IMPORTANT", "STARRED"], removeLabelIds: [] } });
  }
  return specs;
}

export const ALL_TAXONOMY_LABELS = CATEGORY_IDS.map((id) => LABEL_BY_CATEGORY[id]).filter((l): l is string => Boolean(l));
