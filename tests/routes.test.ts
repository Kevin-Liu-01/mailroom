import { describe, expect, it } from "vitest";
import { defaultPolicy, normalizePolicy, parsePolicy, type PolicyConfig } from "@/lib/policy/schema";
import {
  BUILTIN_ROUTES, compileRoutes, isRetired, moreSpecific, overlap, parseFrom, planAdoption, routeClaims, routeLabels,
  senderMatches, senderTokens, splitTerms, subjectHas, type Route,
} from "@/lib/policy/routes";
import { buildFilters } from "@/lib/policy/rules";

const withRoutes = (routes: Route[], patch: Partial<PolicyConfig> = {}): PolicyConfig => {
  const p = defaultPolicy(patch);
  return { ...p, filing: { ...p.filing, routes } };
};
const find = (policy: PolicyConfig, id: string) => {
  const r = compileRoutes(policy).routes.find((x) => x.id === id);
  if (!r) throw new Error(`no route ${id}`);
  return r;
};

describe("terms and senders", () => {
  it("splits OR lists, commas, new lines, and keeps quoted phrases whole", () => {
    expect(splitTerms('uber.com OR lyft.com, doordash.com\ngrubhub.com')).toEqual(["uber.com", "lyft.com", "doordash.com", "grubhub.com"]);
    expect(splitTerms('receipt OR "your order" OR Invitation:')).toEqual(["receipt", "your order", "Invitation:"]);
    expect(senderTokens("Uber.COM OR uber.com")).toEqual(["uber.com"]);
  });
  it("knows which sender is narrower", () => {
    expect(moreSpecific("o.delta.com", "delta.com")).toBe(true);
    expect(moreSpecific("deals@delta.com", "delta.com")).toBe(true);
    expect(moreSpecific("x@o.delta.com", "delta.com")).toBe(true);
    expect(moreSpecific("delta.com", "o.delta.com")).toBe(false);
    expect(moreSpecific("capitaloneshopping.com", "capitalone.com")).toBe(false);
    expect(moreSpecific("idea.com", "ea.com")).toBe(false);
    expect(moreSpecific("github.com", "github")).toBe(true);
    expect(moreSpecific("noreply@github.com", "github")).toBe(true);
    expect(moreSpecific("gitlab.com", "github")).toBe(false);
    expect(overlap("noreply@github.com", "github.com")).toBe("noreply@github.com");
    expect(overlap("uber.com", "lyft.com")).toBeNull();
  });
  it("matches From headers the way Gmail's from: does", () => {
    const f = parseFrom('"Delta Air Lines" <DeltaAirLines@o.delta.com>');
    expect(senderMatches("delta.com", f)).toBe(true);
    expect(senderMatches("o.delta.com", f)).toBe(true);
    expect(senderMatches("deltaairlines@o.delta.com", f)).toBe(true);
    expect(senderMatches("united.com", f)).toBe(false);
    expect(senderMatches("github", parseFrom("GitHub <noreply@github.com>"))).toBe(true);
    expect(senderMatches("claude[bot]", parseFrom('"claude[bot]" <notifications@github.com>'))).toBe(true);
  });
  it("matches subject words whole, in any case", () => {
    expect(subjectHas("receipt", "Your Uber Receipt")).toBe(true);
    expect(subjectHas("order", "Reorder your favorites")).toBe(false);
    expect(subjectHas("your trip", "Thanks for your trip, Kevin")).toBe(true);
    expect(subjectHas("invitation:", "Invitation: Standup @ Mon")).toBe(true);
  });
});

describe("built-in routes", () => {
  it("have unique ids and names", () => {
    expect(new Set(BUILTIN_ROUTES.map((b) => b.id)).size).toBe(BUILTIN_ROUTES.length);
  });
  it("never file the same sender into two categories without a subject to tell them apart", () => {
    for (const a of BUILTIN_ROUTES) for (const b of BUILTIN_ROUTES) {
      if (a === b || a.category === b.category || a.subject || b.subject) continue;
      const shared = senderTokens(a.from).filter((t) => senderTokens(b.from).includes(t));
      expect(shared, `${a.id} and ${b.id}`).toEqual([]);
    }
  });
  it("compile into filters Gmail will accept", () => {
    for (const f of buildFilters(defaultPolicy())) {
      expect(f.criteria.from || f.criteria.subject).toBeTruthy();
      expect((f.criteria.from ?? "").length + (f.criteria.subject ?? "").length + (f.criteria.negatedQuery ?? "").length).toBeLessThan(2400);
    }
  });
  it("never ask Gmail for more than one user label per filter", () => {
    const p = withRoutes([{ category: "receipts", sub: "Uber", from: "uber.com", subject: "trip OR receipt" }, { category: "work", sub: "Acme", from: "acme.com" }]);
    const specs = buildFilters(p);
    for (const f of specs) expect(f.action.addLabelNames.filter((n) => !/^[A-Z_]+$/.test(n)), f.id).toHaveLength(1);
    const uber = specs.filter((f) => f.criteria.from === "uber.com");
    expect(uber.map((f) => f.action.addLabelNames[0]).sort()).toEqual(["Receipts", "Receipts/Uber"]);
    expect(uber.find((f) => f.action.addLabelNames[0] === "Receipts/Uber")!.action.removeLabelIds).toEqual([]);
  });

  it("keep Mailroom's earlier filters recognisable, so a sync can replace them", () => {
    expect(isRetired({ from: "notifications@github.com OR noreply@github.com OR support@github.com" })).toBe(true);
    expect(isRetired({ from: "linkedin.com" })).toBe(false);
  });
});

describe("compiling routes", () => {
  it("files a sub-label under its category and follows the category's settings", () => {
    expect(routeLabels({ category: "receipts", sub: "Uber" })).toEqual(["Receipts", "Receipts/Uber"]);
    const p = withRoutes([{ category: "work", sub: "Acme", from: "acme.com" }, { category: "personal", from: "mom@example.com", star: true }]);
    const work = compileRoutes(p).routes.find((r) => r.category === "work")!;
    expect(work.labels).toEqual(["Work", "Work/Acme"]);
    expect(work.addSystem).toEqual(["IMPORTANT"]);
    const mom = compileRoutes(p).routes.find((r) => r.category === "personal")!;
    expect(mom.addSystem).toContain("STARRED");
    expect(find(p, "dev-github").removeSystem).toEqual(["INBOX", "IMPORTANT"]);
    expect(find(p, "social").removeSystem).toEqual(["IMPORTANT"]);
  });

  it("gives job alerts to Recruiting even though LinkedIn is social", () => {
    const social = find(defaultPolicy(), "social");
    expect(social.excludeSenders).toContain("jobalerts-noreply@linkedin.com");
    expect(social.criteria.negatedQuery).toContain("jobalerts-noreply@linkedin.com");
  });

  it("keeps software invoices out of dev notifications, which get trashed", () => {
    const gh = find(defaultPolicy(), "dev-github");
    expect(gh.excludeSlices[0].senders).toEqual(expect.arrayContaining(["notifications@github.com", "noreply@github.com"]));
    expect(routeClaims(gh, "GitHub <noreply@github.com>", "[GitHub] Payment receipt for Kevin")).toBe(false);
    expect(routeClaims(gh, "GitHub <noreply@github.com>", "[repo] New pull request")).toBe(true);
    expect(routeClaims(find(defaultPolicy(), "receipts-billing"), "GitHub <noreply@github.com>", "[GitHub] Payment receipt for Kevin")).toBe(true);
  });

  it("splits game platforms into receipts and promotions, and leaves account mail alone", () => {
    const p = defaultPolicy();
    const receipt = ["Epic Games Store <help@epicgames.com>", "Your Epic Games Receipt"] as const;
    const promo = ["Epic Games Store <news@epicgames.com>", "Mega Sale ends soon"] as const;
    const code = ["Steam <noreply@steampowered.com>", "Your Steam account: access from new web or mobile device"] as const;
    expect(routeClaims(find(p, "receipts-games"), ...receipt)).toBe(true);
    expect(routeClaims(find(p, "marketing-games"), ...receipt)).toBe(false);
    expect(routeClaims(find(p, "marketing-games"), ...promo)).toBe(true);
    expect(routeClaims(find(p, "marketing-games"), ...code)).toBe(false);
  });

  it("lets a more specific sender win: promos from o.delta.com are marketing, not travel", () => {
    const p = withRoutes([{ category: "marketing", from: "o.delta.com OR enews.united.com" }]);
    const travel = find(p, "travel");
    expect(travel.excludeSenders).toEqual(expect.arrayContaining(["o.delta.com", "enews.united.com"]));
    const marketing = compileRoutes(p).routes.find((r) => r.origin === "custom")!;
    expect(routeClaims(travel, "Delta <DeltaAirLines@o.delta.com>", "Fall fares are here")).toBe(false);
    expect(routeClaims(marketing, "Delta <DeltaAirLines@o.delta.com>", "Fall fares are here")).toBe(true);
    expect(routeClaims(travel, "Delta <noreply@delta.com>", "Your boarding pass")).toBe(true);
  });

  it("lets a subject-qualified route carve out its slice: Uber receipts stay receipts when Uber is marketing", () => {
    const p = withRoutes([{ category: "marketing", from: "uber.com OR doordash.com" }]);
    const marketing = compileRoutes(p).routes.find((r) => r.origin === "custom")!;
    expect(marketing.excludeSlices.some((s) => s.senders.includes("uber.com"))).toBe(true);
    expect(routeClaims(marketing, "Uber Receipts <noreply@uber.com>", "Your Tuesday morning trip with Uber")).toBe(false);
    expect(routeClaims(marketing, "Uber <uber@uber.com>", "Get 40% off your next 3 rides")).toBe(true);
    expect(routeClaims(find(p, "receipts"), "Uber Receipts <noreply@uber.com>", "Your Tuesday morning trip with Uber")).toBe(true);
  });

  it("treats a bare word as the broadest sender, so invoices still leave a 'github' route", () => {
    const p = withRoutes([{ category: "dev", from: "github OR vercel" }]);
    const mine = compileRoutes(p).routes.find((r) => r.origin === "custom")!;
    expect(routeClaims(mine, "GitHub <noreply@github.com>", "[GitHub] Payment receipt for Kevin")).toBe(false);
    expect(routeClaims(mine, "GitHub <notifications@github.com>", "Re: [repo] Fix the build (#12)")).toBe(true);
  });

  it("lets your routes beat the built-ins on the same sender", () => {
    const p = withRoutes([{ category: "marketing", from: "delta.com" }]);
    expect(find(p, "travel").senders).not.toContain("delta.com");
    expect(compileRoutes(p).conflicts).toEqual([]);
  });

  it("reports the same sender in two of your own routes", () => {
    const p = withRoutes([{ category: "marketing", from: "bandsintown.com" }, { category: "social", sub: "Other", from: "bandsintown.com OR strava.com" }]);
    const c = compileRoutes(p).conflicts;
    expect(c).toHaveLength(1);
    expect(c[0].sender).toBe("bandsintown.com");
    expect(c[0].categories.sort()).toEqual(["marketing", "social"]);
  });

  it("drops built-ins you turn off", () => {
    const p = defaultPolicy();
    const off = { ...p, filing: { ...p.filing, builtinsOff: ["marketing-games"] } };
    expect(compileRoutes(off).routes.some((r) => r.id === "marketing-games")).toBe(false);
  });
});

describe("adopting hand-made filters", () => {
  const names: Record<string, string> = {
    L1: "Social Media/LinkedIn", L2: "Banking & Finance", L3: "Newsletters", L4: "Family", L5: "Receipts/Uber", L6: "Princeton", L7: "Work/Acme",
  };
  const filters = [
    { id: "f1", criteria: { from: "linkedin.com" }, action: { addLabelIds: ["L1"], removeLabelIds: ["IMPORTANT", "INBOX"] } },
    { id: "f2", criteria: { from: "chase.com OR examplecu.org OR payroll.example" }, action: { addLabelIds: ["L2"] } },
    { id: "f3", criteria: { from: "tldrnewsletter.com OR smallzine.net" }, action: { addLabelIds: ["L3"], removeLabelIds: ["IMPORTANT"] } },
    { id: "f4", criteria: { from: "dan@tldrnewsletter.com OR quarterly.example" }, action: { addLabelIds: ["L3"] } },
    { id: "f5", criteria: { from: "mail.notion.so" }, action: { removeLabelIds: ["SPAM"] } },
    { id: "f6", criteria: { from: "mom@example.com" }, action: { addLabelIds: ["IMPORTANT", "STARRED", "L4"] } },
    { id: "f7", criteria: { from: "uber.com", subject: 'trip OR receipt OR "your order"' }, action: { addLabelIds: ["L5"], removeLabelIds: ["INBOX"] } },
    { id: "f8", criteria: { from: "school.edu" }, action: { addLabelIds: ["L6"] } },
    { id: "f9", criteria: { from: "acme.com" }, action: { addLabelIds: ["IMPORTANT", "L7"] } },
    { id: "f10", criteria: { from: "notifications@github.com OR noreply@github.com OR support@github.com" }, action: { addLabelIds: ["Ldev"], removeLabelIds: ["INBOX", "IMPORTANT"] } },
    { id: "f11", criteria: { from: "promo.example", to: "me@example.com" }, action: { addLabelIds: ["L3"] } },
  ];
  const plan = planAdoption(filters, (id) => names[id], defaultPolicy(), new Set());

  it("adopts filters that only file mail into a category", () => {
    expect(plan.adopt.map((a) => a.id).sort()).toEqual(["f1", "f2", "f3", "f4", "f7", "f9"]);
  });
  it("leaves everything else alone, with a reason", () => {
    const reasons = Object.fromEntries(plan.keep.map((k) => [k.id, k.reason]));
    expect(reasons.f5).toBe("keeps mail out of spam");
    expect(reasons.f6).toMatch(/outside the categories/);
    expect(reasons.f8).toMatch(/outside the categories/);
    expect(reasons.f11).toMatch(/to/);
    expect(plan.keep.some((k) => k.id === "f10")).toBe(false); // an earlier Mailroom filter: the sync handles it
  });
  it("keeps sub-labels and subject qualifiers, merges same-category lists, and drops what the built-ins cover", () => {
    expect(plan.routes).toContainEqual({ category: "social", sub: "LinkedIn", from: "linkedin.com" });
    expect(plan.routes).toContainEqual({ category: "receipts", sub: "Uber", from: "uber.com", subject: 'trip OR receipt OR "your order"' });
    expect(plan.routes).toContainEqual({ category: "work", sub: "Acme", from: "acme.com" });
    expect(plan.routes).toContainEqual({ category: "finance", from: "examplecu.org OR payroll.example" });
    expect(plan.routes).toContainEqual({ category: "newsletters", from: "smallzine.net OR quarterly.example" });
  });
});

describe("policy schema", () => {
  it("reads a policy saved before filing existed, and survives one bad section", () => {
    const legacy = JSON.parse(JSON.stringify(defaultPolicy())) as Record<string, unknown>;
    delete legacy.filing;
    expect(normalizePolicy(legacy).filing).toEqual({ routes: [], builtinsOff: [] });
    const broken = { ...legacy, aging: { archiveStragglersAfterDays: -5 }, senders: { work: ["acme.com"] } };
    const n = normalizePolicy(broken);
    expect(n.aging.archiveStragglersAfterDays).toBe(2);
    expect(n.senders.work).toEqual(["acme.com"]);
  });
  it("defaults to no routes of your own and no built-ins off", () => {
    expect(defaultPolicy().filing).toEqual({ routes: [], builtinsOff: [] });
  });
  it("rejects a route with nothing to match, and sub-labels with a slash", () => {
    expect(() => parsePolicy({ version: 1, filing: { routes: [{ category: "work" }] } })).toThrow();
    expect(() => parsePolicy({ version: 1, filing: { routes: [{ category: "work", sub: "a/b", from: "acme.com" }] } })).toThrow();
    expect(parsePolicy({ version: 1, filing: { routes: [{ category: "work", sub: "Acme", from: "acme.com" }] } }).filing.routes).toHaveLength(1);
  });
});
