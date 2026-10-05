/**
 * Routes: "mail from these senders (optionally only with these subject words, optionally except these) belongs in
 * <category>, optionally under a sub-label". Built-in routes cover common services; a user's own routes add to them.
 *
 * Gmail applies every matching filter, so overlaps are resolved here, at compile time, by three rules:
 *   1. A more specific sender wins. `o.delta.com` filed as marketing is excluded from a `delta.com` travel route.
 *   2. A subject-qualified route carves out its slice. Uber receipts filed as receipts are excluded from an
 *      unqualified `uber.com` marketing route; the rest of Uber's mail stays marketing.
 *   3. Your routes beat the built-in ones. If you file `delta.com` as marketing, the built-in travel route drops it.
 * Anything left (the same sender, unqualified, in two of your own routes) is reported as a conflict.
 *
 * Everything here is pure: the same code compiles Gmail filters, explains conflicts in the UI, plans the adoption of
 * hand-made filters, and decides in code which route a message belongs to.
 */
import { LABEL_BY_CATEGORY, type CategoryId, type PolicyConfig } from "./schema";

export type FileCategory = Exclude<CategoryId, "other">;

export type Route = {
  /** Stable id for built-in routes; derived from content for your own. */
  id?: string;
  category: FileCategory;
  /** Nested label under the category: "Uber" files into "Receipts" and "Receipts/Uber". */
  sub?: string;
  /** Senders: domains, addresses, or words, separated by OR, commas, or new lines. */
  from?: string;
  /** Only when the subject has one of these words or quoted phrases. */
  subject?: string;
  /** Except when the subject has one of these. */
  except?: string;
  /** Star this mail as well, which also protects it from every trash rule. */
  star?: boolean;
};

export type RouteOrigin = "builtin" | "custom" | "senders";

/* ---------------------------------------------------------------------------------------------------------------
 * Built-in routes. Generic, widely used services only: nothing personal belongs in this list.
 * ------------------------------------------------------------------------------------------------------------- */

const SECURITY_SUBJECT =
  '"verification code" OR "security code" OR "one-time" OR "verify your email" OR "confirm your email" OR "sign-in attempt" OR "new sign-in" OR "login code" OR "password reset" OR "2-step" OR "two-factor" OR "your code is" OR "authentication code" OR "single-use code" OR "temporary password"';
const ACCOUNT_WORDS = 'code OR verification OR verify OR "sign in" OR "sign-in" OR password OR security OR "new device" OR "steam guard" OR account';
const GAMES =
  "steampowered.com OR steamcommunity.com OR epicgames.com OR playstation.com OR sonyentertainmentnetwork.com OR xbox.com OR nintendo.com OR nintendo.net OR riotgames.com OR supercell.com OR nianticlabs.com OR blizzard.com OR battle.net OR ea.com OR ubisoft.com OR roblox.com OR gog.com OR humblebundle.com OR minecraft.net OR mojang.com";
const STREAMING =
  "spotify.com OR netflix.com OR hulu.com OR disneyplus.com OR max.com OR hbomax.com OR peacocktv.com OR paramountplus.com OR audible.com OR crunchyroll.com OR siriusxm.com OR tidal.com";
const SAAS =
  "vercel.com OR github.com OR openai.com OR anthropic.com OR cloudflare.com OR netlify.com OR supabase.com OR supabase.io OR render.com OR railway.app OR fly.io OR digitalocean.com OR heroku.com OR amazonaws.com OR linear.app OR notion.so OR figma.com OR slack.com OR zoom.us OR mongodb.com OR twilio.com OR sendgrid.com OR posthog.com OR sentry.io OR datadoghq.com OR atlassian.com OR jetbrains.com OR cursor.com OR replit.com OR neon.tech OR planetscale.com OR upstash.com OR clerk.com OR clerk.dev OR resend.com OR modal.com OR huggingface.co OR replicate.com";

export const BUILTIN_ROUTES: (Route & { id: string; name: string })[] = [
  { id: "security-codes", name: "Codes and sign-in alerts", category: "security", subject: SECURITY_SUBJECT },
  { id: "dev-vercel", name: "Vercel", category: "dev", from: "notifications@vercel.com OR invoice+statements@vercel.com OR ship@info.vercel.com" },
  { id: "dev-github", name: "GitHub", category: "dev", from: "notifications@github.com OR noreply@github.com OR support@github.com" },
  {
    id: "dev-other", name: "Developer tools", category: "dev",
    from: "sentry.io OR supabase.com OR supabase.io OR cloudflare.com OR netlify.com OR npmjs.com OR circleci.com OR travis-ci.com OR render.com OR railway.app OR fly.io OR planetscale.com OR neon.tech OR datadoghq.com OR pagerduty.com OR linear.app OR atlassian.net OR jira.com OR docker.com OR heroku.com OR expo.dev OR upstash.com OR clerk.com OR clerk.dev OR crates.io OR pypi.org OR gitlab.com OR bitbucket.org OR digitalocean.com OR posthog.com OR mongodb.com OR twilio.com OR sendgrid.com OR resend.com OR replit.com OR stackblitz.com OR codesandbox.io OR huggingface.co OR replicate.com OR modal.com OR amazonaws.com",
  },
  {
    id: "social", name: "Social networks", category: "social",
    from: "linkedin.com OR nextdoor.com OR instagram.com OR facebook.com OR facebookmail.com OR twitter.com OR x.com OR youtube.com OR discord.com OR discordapp.com OR reddit.com OR redditmail.com OR tiktok.com OR pinterest.com OR snapchat.com OR threads.net OR quora.com OR strava.com OR bereal.com OR twitch.tv OR tumblr.com OR bsky.app OR goodreads.com OR letterboxd.com OR mastodon.social",
  },
  {
    id: "receipts", name: "Orders, rides, and deliveries", category: "receipts",
    from: "uber.com OR ubereats.com OR lyft.com OR doordash.com OR grubhub.com OR instacart.com OR seamless.com OR postmates.com OR gopuff.com OR toasttab.com OR auto-confirm@amazon.com OR shipment-tracking@amazon.com OR order-update@amazon.com OR digital-no-reply@amazon.com OR payments-messages@amazon.com OR return@amazon.com OR ship-confirm@amazon.com OR no_reply@email.apple.com OR ebay.com OR etsy.com",
    subject: 'receipt OR order OR ordered OR trip OR shipped OR delivered OR "out for delivery" OR "no-contact delivery" OR arriving OR "your ride" OR invoice OR confirmation OR "payment received" OR "thank you for your purchase"',
  },
  {
    id: "receipts-billing", name: "Software invoices", category: "receipts", from: SAAS,
    subject: 'invoice OR receipt OR "payment received" OR "payment confirmation" OR "billing statement" OR "your bill"',
  },
  { id: "receipts-games", name: "Game purchases", category: "receipts", from: GAMES, subject: 'receipt OR purchase OR "your order" OR "order confirmation" OR "thank you for your" OR invoice OR "payment received"' },
  { id: "marketing-games", name: "Game platform promotions", category: "marketing", from: GAMES, except: ACCOUNT_WORDS },
  { id: "receipts-streaming", name: "Subscription receipts", category: "receipts", from: STREAMING, subject: 'receipt OR invoice OR "payment received" OR "your payment" OR "payment confirmation" OR "subscription confirmed" OR "thank you for your purchase"' },
  { id: "marketing-streaming", name: "Streaming promotions", category: "marketing", from: STREAMING, except: ACCOUNT_WORDS },
  {
    id: "newsletters", name: "Newsletters and publications", category: "newsletters",
    from: "tldrnewsletter.com OR substack.com OR beehiiv.com OR morningbrew.com OR theinformation.com OR nytimes.com OR email.cnn.com OR newsletters.cnn.com OR bloomberg.com OR economist.com OR axios.com OR every.to OR convertkit.com OR mailchimp.com OR buttondown.email OR medium.com OR wsj.com OR washingtonpost.com OR theatlantic.com OR newyorker.com OR ft.com OR semafor.com OR platformer.news OR reuters.com OR politico.com OR theverge.com OR techcrunch.com OR wired.com OR arstechnica.com OR stratechery.com OR lennysnewsletter.com OR pragmaticengineer.com OR producthunt.com OR hackernewsletter.com OR quantamagazine.org OR smartbrief.com OR thehustle.co OR dev.to OR indiehackers.com OR deeplearning.ai OR therundown.ai",
  },
  {
    id: "finance", name: "Banks, cards, and money", category: "finance",
    from: "chase.com OR bankofamerica.com OR wellsfargo.com OR tdbank.com OR capitalone.com OR amex.com OR americanexpress.com OR aexp.com OR discover.com OR citi.com OR robinhood.com OR wealthfront.com OR wealthfrontmail.com OR fidelity.com OR schwab.com OR vanguard.com OR experian.com OR equifax.com OR transunion.com OR creditkarma.com OR mint.com OR venmo.com OR paypal.com OR zellepay.com OR cash.app OR wise.com OR irs.gov OR turbotax.intuit.com OR intuit.com OR stripe.com OR mercury.com OR brex.com OR ramp.com OR sofi.com OR ally.com OR marcus.com OR betterment.com OR coinbase.com OR etrade.com OR webull.com OR kraken.com OR affirm.com OR klarna.com OR plaid.com OR gusto.com OR rippling.com OR adp.com OR justworks.com OR carta.com OR guideline.com OR empower.com OR bilt.com",
  },
  {
    id: "travel", name: "Flights, trains, and stays", category: "travel",
    from: "united.com OR delta.com OR aa.com OR southwest.com OR jetblue.com OR alaskaair.com OR spirit.com OR flyfrontier.com OR amtrak.com OR marriott.com OR hilton.com OR hyatt.com OR ihg.com OR airbnb.com OR vrbo.com OR booking.com OR expedia.com OR hotels.com OR priceline.com OR hotwire.com OR kayak.com OR hopper.com OR tripadvisor.com OR trip.com OR tripit.com OR flixbus.com OR greyhound.com OR tsa.gov OR hertz.com OR avis.com OR enterprise.com OR turo.com",
  },
  {
    id: "events", name: "Tickets and RSVPs", category: "events",
    from: "luma.com OR luma-mail.com OR lu.ma OR eventbrite.com OR meetup.com OR partiful.com OR ticketmaster.com OR livenation.com OR axs.com OR stubhub.com OR seatgeek.com OR dice.fm OR ra.co OR posh.vip OR shotgun.live OR tixr.com OR feverup.com OR universe.com OR splashthat.com OR calendar-notification@google.com",
  },
  { id: "events-invitations", name: "Calendar invitations", category: "events", subject: '"Invitation:" OR "Updated invitation" OR "Accepted:" OR "Declined:" OR "Invitation from an unknown sender"' },
  {
    id: "recruiting", name: "Job boards and applicant tracking", category: "recruiting",
    from: "greenhouse.io OR greenhouse-mail.io OR lever.co OR ashbyhq.com OR workday.com OR myworkday.com OR myworkdayjobs.com OR smartrecruiters.com OR icims.com OR jobvite.com OR hired.com OR wellfound.com OR angel.co OR indeed.com OR glassdoor.com OR ziprecruiter.com OR triplebyte.com OR otta.com OR simplify.jobs OR joinhandshake.com OR ripplematch.com OR gem.com OR dover.com OR codesignal.com OR hackerrank.com OR karat.com OR jobalerts-noreply@linkedin.com OR jobs-noreply@linkedin.com OR jobs-listings@linkedin.com OR inmail-hit-reply@linkedin.com",
  },
];

/**
 * Criteria of filters earlier versions of Mailroom created. A filter with exactly these criteria is Mailroom's own,
 * so the sync may replace it even though nothing recorded its id.
 */
export const RETIRED_CRITERIA: { from?: string; subject?: string }[] = [
  { subject: SECURITY_SUBJECT },
  { from: "notifications@vercel.com OR invoice+statements@vercel.com OR ship@info.vercel.com" },
  { from: "notifications@github.com OR noreply@github.com OR support@github.com" },
  { from: "sentry.io OR supabase.com OR supabase.io OR cloudflare.com OR netlify.com OR npmjs.com OR circleci.com OR travis-ci.com OR render.com OR railway.app OR fly.io OR planetscale.com OR neon.tech OR datadoghq.com OR pagerduty.com OR linear.app OR atlassian.net OR jira.com" },
  { from: "linkedin.com OR nextdoor.com OR instagram.com OR facebook.com OR facebookmail.com OR twitter.com OR x.com OR youtube.com OR discord.com OR reddit.com OR redditmail.com OR tiktok.com OR pinterest.com OR snapchat.com OR threads.net OR quora.com OR medium.com" },
  { from: "uber.com OR doordash.com OR auto-confirm@amazon.com OR shipment-tracking@amazon.com OR order-update@amazon.com OR no_reply@email.apple.com OR grubhub.com OR lyft.com OR instacart.com OR ubereats.com", subject: 'receipt OR order OR delivered OR shipped OR "your trip" OR confirmation OR invoice' },
  { from: "tldrnewsletter.com OR substack.com OR beehiiv.com OR morningbrew.com OR theinformation.com OR nytimes.com OR email.cnn.com OR newsletters.cnn.com OR bloomberg.com OR economist.com OR axios.com OR every.to OR convertkit.com OR mailchimp.com OR buttondown.email" },
  { from: "chase.com OR bankofamerica.com OR wellsfargo.com OR tdbank.com OR capitalone.com OR amex.com OR americanexpress.com OR discover.com OR citi.com OR robinhood.com OR wealthfront.com OR wealthfrontmail.com OR fidelity.com OR schwab.com OR vanguard.com OR experian.com OR creditkarma.com OR mint.com OR venmo.com OR paypal.com OR zellepay.com OR irs.gov OR turbotax.intuit.com OR stripe.com OR mercury.com OR brex.com" },
  { from: "united.com OR delta.com OR aa.com OR southwest.com OR jetblue.com OR alaskaair.com OR amtrak.com OR marriott.com OR hilton.com OR hyatt.com OR airbnb.com OR booking.com OR expedia.com OR hotels.com OR kayak.com OR tripit.com OR hertz.com OR avis.com OR enterprise.com" },
  { from: "luma.com OR luma-mail.com OR lu.ma OR eventbrite.com OR meetup.com OR partiful.com OR ticketmaster.com OR axs.com OR dice.fm OR splashthat.com OR calendar-notification@google.com" },
  { subject: '"Invitation:" OR "Updated invitation" OR "Accepted:" OR "Declined:" OR "Invitation from an unknown sender"' },
  { from: "greenhouse.io OR lever.co OR ashbyhq.com OR workday.com OR myworkday.com OR smartrecruiters.com OR icims.com OR jobvite.com OR hired.com OR wellfound.com OR angel.co OR indeed.com OR glassdoor.com OR ziprecruiter.com OR triplebyte.com OR otta.com OR simplify.jobs" },
];

/* ---------------------------------------------------------------------------------------------------------------
 * Terms and senders
 * ------------------------------------------------------------------------------------------------------------- */

/** Split an OR / comma / newline separated list into terms. Quoted phrases stay whole; the word OR is a separator. */
export function splitTerms(expr?: string | null): string[] {
  if (!expr) return [];
  const out: string[] = [];
  for (const m of expr.matchAll(/"([^"]+)"|([^\s,(){}"]+)/g)) {
    const t = (m[1] ?? m[2] ?? "").trim();
    if (!t || (!m[1] && t.toUpperCase() === "OR")) continue;
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** Senders are compared lowercase. */
export const senderTokens = (expr?: string | null) => splitTerms(expr).map((t) => t.toLowerCase());

/** Gmail's "from" expression for a list of senders. */
export const formatSenders = (tokens: string[]) => tokens.join(" OR ");

/** Gmail's subject expression: anything that is not a plain word is quoted. */
export const formatTerms = (terms: string[]) => terms.map((t) => (/^[\p{L}\p{N}]+$/u.test(t) ? t : `"${t.replace(/"/g, "")}"`)).join(" OR ");

const isAddress = (t: string) => t.includes("@");
const isDomain = (t: string) => !isAddress(t) && t.includes(".");

/**
 * True when sender `a` names a strict subset of the mail sender `b` names: a subdomain, or an address within it. A
 * bare word ("github") matches every sender containing it, so any address or domain containing the word is narrower.
 */
export function moreSpecific(a: string, b: string): boolean {
  if (a === b) return false;
  if (!isAddress(b) && !isDomain(b)) return (isAddress(a) || isDomain(a)) && a.split(/[^\p{L}\p{N}[\]]+/u).includes(b);
  if (!isDomain(b)) return false;
  const domA = isAddress(a) ? a.split("@")[1] : a;
  if (!domA.includes(".")) return false;
  return domA === b ? isAddress(a) : domA.endsWith(`.${b}`);
}

/** Where two senders overlap, the narrower one; null when they are disjoint. */
export function overlap(a: string, b: string): string | null {
  if (a === b) return a;
  if (moreSpecific(a, b)) return a;
  if (moreSpecific(b, a)) return b;
  return null;
}

export type ParsedFrom = { address: string; domain: string; name: string };

export function parseFrom(header: string): ParsedFrom {
  const m = header.match(/<([^>]+)>/);
  const address = (m ? m[1] : header).trim().toLowerCase();
  const name = (m ? header.slice(0, m.index) : "").replace(/"/g, "").trim().toLowerCase();
  return { address, domain: address.includes("@") ? address.split("@")[1] : "", name };
}

/** Gmail's `from:` semantics, closely enough to decide routing in code. */
export function senderMatches(token: string, f: ParsedFrom): boolean {
  if (isAddress(token)) return f.address === token;
  if (isDomain(token)) return f.domain === token || f.domain.endsWith(`.${token}`);
  const words = `${f.address} ${f.name}`.split(/[^\p{L}\p{N}[\]]+/u);
  return words.includes(token) || f.name.includes(token);
}

/** Gmail's `subject:` semantics for a word or phrase: whole words, any case. */
export function subjectHas(term: string, subject: string): boolean {
  const esc = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, "u").test(subject.toLowerCase());
}

/* ---------------------------------------------------------------------------------------------------------------
 * Compile
 * ------------------------------------------------------------------------------------------------------------- */

export type CompiledRoute = {
  id: string;
  name: string;
  origin: RouteOrigin;
  category: FileCategory;
  sub?: string;
  star: boolean;
  senders: string[];
  subject: string[];
  except: string[];
  /** More specific senders another category claims outright. */
  excludeSenders: string[];
  /** Subject-qualified slices another category claims. */
  excludeSlices: { senders: string[]; subject: string[] }[];
  /** Label names this route adds: the category, and the sub-label when there is one. */
  labels: string[];
  /** System labels to add (IMPORTANT, STARRED) and to remove (INBOX, IMPORTANT). */
  addSystem: string[];
  removeSystem: string[];
  criteria: { from?: string; subject?: string; negatedQuery?: string };
};

export type RouteConflict = { sender: string; categories: FileCategory[]; routes: string[] };

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

export const routeId = (r: Route) => r.id ?? `route-${r.category}${r.sub ? `-${r.sub.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}-${hash(`${r.from ?? ""}|${r.subject ?? ""}|${r.except ?? ""}|${r.star ? 1 : 0}`)}`;

export const categoryLabel = (c: FileCategory) => LABEL_BY_CATEGORY[c] as string;

export function routeLabels(r: Pick<Route, "category" | "sub">): string[] {
  const parent = categoryLabel(r.category);
  const sub = r.sub?.trim();
  return sub ? [parent, `${parent}/${sub}`] : [parent];
}

/** The routes a policy runs: built-ins it has not turned off, its own routes, and the older sender lists. */
export function policyRoutes(policy: PolicyConfig): { route: Route; origin: RouteOrigin; name: string }[] {
  const off = new Set(policy.filing.builtinsOff);
  const out: { route: Route; origin: RouteOrigin; name: string }[] = BUILTIN_ROUTES.filter((b) => !off.has(b.id)).map((b) => ({ route: b, origin: "builtin", name: b.name }));
  for (const r of policy.filing.routes) out.push({ route: r, origin: "custom", name: r.sub ? `${categoryLabel(r.category)}/${r.sub}` : categoryLabel(r.category) });
  const s = policy.senders;
  if (s.heavyPromo.length) out.push({ route: { id: "heavy-promo", category: "marketing", from: s.heavyPromo.join(" OR ") }, origin: "senders", name: "Heavy promotional senders" });
  if (s.work.length) out.push({ route: { id: "work", category: "work", from: s.work.join(" OR ") }, origin: "senders", name: "Work domains" });
  if (s.family.length) out.push({ route: { id: "family", category: "personal", from: s.family.join(" OR "), star: true }, origin: "senders", name: "Family and friends" });
  return out;
}

/** Compile a policy's routes into Gmail filter specs, resolving every overlap by the three rules above. */
export function compileRoutes(policy: PolicyConfig): { routes: CompiledRoute[]; conflicts: RouteConflict[] } {
  const skip = new Set(policy.categories.skipInbox);
  const never = new Set(policy.categories.neverImportant);
  const always = new Set(policy.categories.alwaysImportant);

  const base = policyRoutes(policy).map(({ route, origin, name }) => ({
    route, origin, name,
    senders: senderTokens(route.from),
    subject: splitTerms(route.subject),
    except: splitTerms(route.except),
  }));

  // Rule 3: your routes (and your sender lists) beat the built-ins on senders both name without a subject qualifier.
  const yours = base.filter((r) => r.origin !== "builtin" && r.senders.length && !r.subject.length);
  for (const b of base) {
    if (b.origin !== "builtin" || b.subject.length) continue;
    b.senders = b.senders.filter((t) => !yours.some((c) => c.route.category !== b.route.category && c.senders.includes(t)));
  }
  const live = base.filter((r) => r.senders.length || r.subject.length);

  const conflicts = new Map<string, RouteConflict>();
  const routes: CompiledRoute[] = live.map((a) => {
    const excludeSenders = new Set<string>();
    const slices = new Map<string, { senders: Set<string>; subject: string[] }>();
    if (a.senders.length) {
      for (const b of live) {
        if (b === a || b.route.category === a.route.category || !b.senders.length) continue;
        if (b.subject.length) {
          // Rule 2: only an unqualified route gives up a qualified route's slice; two qualified routes may overlap.
          if (a.subject.length) continue;
          const shared = new Set<string>();
          for (const ta of a.senders) for (const tb of b.senders) { const o = overlap(ta, tb); if (o) shared.add(o); }
          if (shared.size) {
            const key = b.subject.join("\u0000");
            const slice = slices.get(key) ?? { senders: new Set<string>(), subject: b.subject };
            for (const t of shared) slice.senders.add(t);
            slices.set(key, slice);
          }
        } else {
          for (const tb of b.senders) {
            // Rule 1: a strictly narrower sender filed elsewhere is excluded here. A subject-qualified route keeps its
            // slice instead (rule 2 makes the unqualified route give it up), or the slice would belong to nobody.
            if (!a.subject.length && a.senders.some((ta) => moreSpecific(tb, ta))) excludeSenders.add(tb);
            // The same sender, unqualified, in two categories: report it.
            if (!a.subject.length && a.senders.includes(tb)) {
              const c = conflicts.get(tb) ?? { sender: tb, categories: [], routes: [] };
              for (const [cat, id] of [[a.route.category, routeId(a.route)], [b.route.category, routeId(b.route)]] as const) {
                if (!c.categories.includes(cat)) c.categories.push(cat);
                if (!c.routes.includes(id)) c.routes.push(id);
              }
              conflicts.set(tb, c);
            }
          }
        }
      }
    }
    const excludeSlices = [...slices.values()].map((s) => ({ senders: [...s.senders], subject: s.subject }));
    const negated = [
      a.except.length ? `subject:(${formatTerms(a.except)})` : null,
      excludeSenders.size ? `from:(${formatSenders([...excludeSenders])})` : null,
      ...excludeSlices.map((s) => `(from:(${formatSenders(s.senders)}) subject:(${formatTerms(s.subject)}))`),
    ].filter((p): p is string => Boolean(p));

    const cat = a.route.category;
    const addSystem = [...(always.has(cat) && !never.has(cat) ? ["IMPORTANT"] : []), ...(a.route.star ? ["STARRED"] : [])];
    const removeSystem = [...(skip.has(cat) ? ["INBOX"] : []), ...(never.has(cat) ? ["IMPORTANT"] : [])];
    const criteria: CompiledRoute["criteria"] = {};
    if (a.senders.length) criteria.from = formatSenders(a.senders);
    if (a.subject.length) criteria.subject = a.route.from || a.origin !== "builtin" ? formatTerms(a.subject) : a.route.subject;
    if (negated.length) criteria.negatedQuery = negated.join(" OR ");
    return {
      id: routeId(a.route), name: a.name, origin: a.origin, category: cat, sub: a.route.sub?.trim() || undefined, star: Boolean(a.route.star),
      senders: a.senders, subject: a.subject, except: a.except, excludeSenders: [...excludeSenders], excludeSlices,
      labels: routeLabels(a.route), addSystem, removeSystem, criteria,
    };
  });
  return { routes, conflicts: [...conflicts.values()] };
}

/** Every label name the routes file into, parents first. */
export function routeLabelNames(routes: CompiledRoute[]): string[] {
  return [...new Set(routes.flatMap((r) => r.labels))].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
}

/** Does this compiled route claim a message with this From header and subject? Mirrors the Gmail filter. */
export function routeClaims(r: CompiledRoute, from: string, subject: string): boolean {
  const f = parseFrom(from);
  if (r.senders.length && !r.senders.some((t) => senderMatches(t, f))) return false;
  if (r.subject.length && !r.subject.some((t) => subjectHas(t, subject))) return false;
  if (!r.senders.length && !r.subject.length) return false;
  if (r.except.some((t) => subjectHas(t, subject))) return false;
  if (r.excludeSenders.some((t) => senderMatches(t, f))) return false;
  if (r.excludeSlices.some((s) => s.senders.some((t) => senderMatches(t, f)) && s.subject.some((t) => subjectHas(t, subject)))) return false;
  return true;
}

/**
 * Does this route name the sender at all, ignoring its subject qualifier? True unless the route explicitly gives the
 * message up (a narrower sender filed elsewhere, or a slice another category carved out). Reconcile keeps a label
 * when its own route names the sender: a qualifier that merely failed to match is a heuristic, not a verdict.
 */
export function routeNames(r: CompiledRoute, from: string, subject: string): boolean {
  const f = parseFrom(from);
  if (!r.senders.some((t) => senderMatches(t, f))) return false;
  if (r.excludeSenders.some((t) => senderMatches(t, f))) return false;
  if (r.excludeSlices.some((s) => s.senders.some((t) => senderMatches(t, f)) && s.subject.some((t) => subjectHas(t, subject)))) return false;
  return true;
}

/** The Gmail search that finds what a compiled route claims. */
export function routeQuery(r: CompiledRoute): string {
  const parts: string[] = [];
  if (r.criteria.from) parts.push(`from:(${r.criteria.from})`);
  if (r.criteria.subject) parts.push(`subject:(${r.criteria.subject})`);
  if (r.criteria.negatedQuery) parts.push(`-(${r.criteria.negatedQuery})`);
  return parts.join(" ");
}

/* ---------------------------------------------------------------------------------------------------------------
 * Adoption: turn hand-made Gmail filters that file into the taxonomy into routes, so one system owns filing.
 * ------------------------------------------------------------------------------------------------------------- */

export type GmailFilterLike = {
  id: string;
  criteria: Record<string, unknown>;
  action: { addLabelIds?: string[]; removeLabelIds?: string[]; forward?: string };
};

export type AdoptionItem = { id: string; labels: string[]; senders: string; route?: Route; reason?: string };
export type AdoptionPlan = { adopt: AdoptionItem[]; keep: AdoptionItem[]; routes: Route[] };

const TAXONOMY = new Map(
  (Object.entries(LABEL_BY_CATEGORY) as [CategoryId, string | null][]).filter((e): e is [FileCategory, string] => Boolean(e[1])).map(([id, label]) => [label, id]),
);

const same = (a = "", b = "") => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();
export const isRetired = (c: Record<string, unknown>) =>
  RETIRED_CRITERIA.some((r) => same(r.from, c.from as string | undefined) && same(r.subject, c.subject as string | undefined) && !c.negatedQuery && !c.query && !c.to);

const routeKey = (r: Route) => [r.category, r.sub?.toLowerCase() ?? "", splitTerms(r.subject).join("|").toLowerCase(), splitTerms(r.except).join("|").toLowerCase(), r.star ? 1 : 0].join("\u0000");

/**
 * Plan the adoption of hand-made filters. A filter is adopted when all it does is file mail from senders (and
 * optionally subject words) into one taxonomy category, optionally a sub-label, optionally starred or important.
 * Anything else (forwarding, never-spam, Gmail tabs, labels outside the taxonomy) is left alone with a reason.
 */
export function planAdoption(filters: GmailFilterLike[], labelName: (id: string) => string | undefined, policy: PolicyConfig, skipIds: Set<string>): AdoptionPlan {
  const adopt: AdoptionItem[] = [], keep: AdoptionItem[] = [];
  const merged = new Map<string, Route>();
  for (const r of policy.filing.routes) merged.set(routeKey(r), { ...r });

  for (const f of filters) {
    if (skipIds.has(f.id) || isRetired(f.criteria)) continue;
    const adds = f.action.addLabelIds ?? [];
    const removes = f.action.removeLabelIds ?? [];
    const userLabels = adds.filter((id) => !/^[A-Z_]+$/.test(id)).map((id) => labelName(id) ?? id);
    const item: AdoptionItem = { id: f.id, labels: [...userLabels, ...adds.filter((id) => /^[A-Z_]+$/.test(id))], senders: String(f.criteria.from ?? f.criteria.subject ?? f.criteria.query ?? "") };
    const extra = Object.keys(f.criteria).filter((k) => !["from", "subject"].includes(k) && f.criteria[k] !== undefined && f.criteria[k] !== "");
    const sys = adds.filter((id) => /^[A-Z_]+$/.test(id));
    const reason =
      f.action.forward ? "forwards mail"
      : extra.length ? `matches on ${extra.join(", ")}, which routes do not express`
      : removes.some((l) => !["INBOX", "IMPORTANT"].includes(l)) ? (removes.includes("SPAM") ? "keeps mail out of spam" : `removes ${removes.filter((l) => !["INBOX", "IMPORTANT"].includes(l)).join(", ")}`)
      : sys.some((l) => !["IMPORTANT", "STARRED"].includes(l)) ? (sys.find((l) => l.startsWith("CATEGORY_")) ? "moves mail to a Gmail tab" : `adds ${sys.join(", ")}`)
      : !userLabels.length ? "adds no label"
      : null;
    if (reason) { keep.push({ ...item, reason }); continue; }

    const paths = userLabels.map((n) => n.split("/"));
    const parents = new Set(paths.map((p) => p[0]));
    const category = parents.size === 1 ? TAXONOMY.get([...parents][0]) : undefined;
    const subs = [...new Set(paths.filter((p) => p.length > 1).map((p) => p.slice(1).join("/")))];
    if (!category) { keep.push({ ...item, reason: parents.size > 1 ? "files into more than one category" : `files under "${userLabels[0]}", outside the categories` }); continue; }
    if (subs.length > 1 || subs.some((s) => s.includes("/"))) { keep.push({ ...item, reason: "files into more than one sub-label" }); continue; }

    const route: Route = { category, sub: subs[0], from: (f.criteria.from as string | undefined) || undefined, subject: (f.criteria.subject as string | undefined) || undefined, star: sys.includes("STARRED") || undefined };
    adopt.push({ ...item, route });
    const key = routeKey(route);
    const prev = merged.get(key);
    if (!prev) merged.set(key, { category: route.category, sub: route.sub, from: route.from, subject: route.subject, star: route.star });
    else prev.from = formatSenders([...new Set([...senderTokens(prev.from), ...senderTokens(route.from)])]) || undefined;
  }

  // A plain route needs only the senders the built-in route for its category does not already cover.
  const routes: Route[] = [];
  for (const r of merged.values()) {
    const plain = !r.sub && !r.subject && !r.except && !r.star;
    if (plain && r.from) {
      const covered = BUILTIN_ROUTES.filter((b) => b.category === r.category && !b.subject && !policy.filing.builtinsOff.includes(b.id)).flatMap((b) => senderTokens(b.from));
      const rest = senderTokens(r.from).filter((t) => !covered.some((c) => c === t || moreSpecific(t, c)));
      if (!rest.length) continue;
      r.from = formatSenders(rest);
    }
    if (!r.from && !r.subject) continue;
    routes.push(Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined && v !== "")) as Route);
  }
  return { adopt, keep, routes };
}
