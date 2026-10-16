import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig, { ANALYTICS_PAGES } from "../next.config";
import { ANALYTICS_HOST, ANALYTICS_PATHS, CONSENT_REGIONS, GA_MEASUREMENT_ID, analyticsEnabled, analyticsScript, isAnalyticsPath } from "@/lib/analytics";

/**
 * Google Analytics 4 runs on the public pages alone (src/lib/analytics.ts): the landing, /privacy and /terms, signed
 * out, on the production host. These pin where the tag can be mounted, what its script does in a browser (a stub
 * DOM in a fresh realm), and the CSP that allows it. The signed-in app and the API never get any of it.
 */

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));

afterEach(() => {
  vi.unstubAllEnvs();
  auth.mockReset();
});

const SRC = path.resolve(__dirname, "../src");
const APP = path.join(SRC, "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mts)$/.test(name)) out.push(full);
  }
  return out;
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join("/");
/** `app/privacy/page.tsx` → "/privacy"; `app/page.tsx` → "/". */
const urlOf = (file: string) => `/${path.relative(APP, path.dirname(file)).split(path.sep).join("/")}`.replace(/\/$/, "") || "/";

describe("where the tag can appear", () => {
  const files = walk(SRC);
  const mounts = files.filter((f) => /from ["']@\/components\/Analytics["']/.test(readFileSync(f, "utf8")));

  it("exactly the public pages mount it, and each is an analytics path", () => {
    expect(mounts.map(rel).sort()).toEqual(["app/page.tsx", "app/privacy/page.tsx", "app/terms/page.tsx"]);
    expect(mounts.map(urlOf).sort()).toEqual([...ANALYTICS_PATHS].sort());
    for (const file of mounts) expect(readFileSync(file, "utf8"), rel(file)).toMatch(/<Analytics \/>/);
  });

  it("no app route, API route, layout or app component reaches the tag or its script", () => {
    const app = files.filter((f) => /^app\/(app|api)\//.test(rel(f)) || /(^|\/)layout\.tsx$/.test(rel(f)) || /^components\/app\//.test(rel(f)));
    expect(app.map(rel)).toEqual(expect.arrayContaining(["app/layout.tsx", "app/app/layout.tsx", "app/app/search/page.tsx", "app/api/search/route.ts"]));
    for (const file of app) expect(readFileSync(file, "utf8"), rel(file)).not.toMatch(/components\/Analytics|lib\/analytics|googletagmanager|G-[A-Z0-9]{6,}/);
    // the script and the ID live in one module, rendered by one component
    const carriers = files.filter((f) => /lib\/analytics["']|analyticsScript|G-QXXZK16XLJ/.test(readFileSync(f, "utf8"))).map(rel).sort();
    expect(carriers).toEqual(["components/Analytics.tsx", "lib/analytics.ts"]);
  });

  it("every app page and API path is outside the allowlist", () => {
    const routes = files.filter((f) => /^app\/(app|api)\/.*(page|route)\.tsx?$/.test(rel(f))).map(urlOf);
    expect(routes).toEqual(expect.arrayContaining(["/app", "/app/search", "/app/runs/[id]", "/api/search", "/api/auth/[...nextauth]"]));
    for (const p of routes) expect(isAnalyticsPath(p), p).toBe(false);
    for (const p of ["/app", "/app/", "/app/search", "/api/auth/callback/google", "/og", "/privacy/", "/terms/x", "", "/?q=x"]) expect(isAnalyticsPath(p), p).toBe(false);
    for (const p of ANALYTICS_PATHS) expect(isAnalyticsPath(p), p).toBe(true);
  });
});

describe("the component", () => {
  it("renders the script in production for a signed-out visitor, and nothing otherwise", async () => {
    const { Analytics } = await import("@/components/Analytics");
    expect(await Analytics()).toBeNull(); // no VERCEL_ENV: tests, `next dev`
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await Analytics()).toBeNull();
    expect(auth).not.toHaveBeenCalled();
    vi.stubEnv("VERCEL_ENV", "production");
    expect(analyticsEnabled()).toBe(true);
    auth.mockResolvedValue({ user: { id: "u1" } });
    expect(await Analytics()).toBeNull(); // signed in: the app's people are never measured
    auth.mockResolvedValue(null);
    const el = await Analytics();
    expect(el?.props).toMatchObject({ id: "mailroom-ga", strategy: "afterInteractive", children: analyticsScript() });
  });
});

/** The script in a fresh realm with a stub DOM: what it pushes, appends, wraps and listens for. */
function run({ href, began = href, referrer = "" }: { href: string; began?: string; referrer?: string }) {
  const url = new URL(href);
  const calls = { assign: [] as string[], replace: [] as string[], reload: 0, pushed: [] as unknown[], replaced: [] as unknown[] };
  const listeners: Record<string, { fn: (e: object) => void; capture: boolean }[]> = {};
  const appended: { src: string; async: boolean; queued: number }[] = [];
  const nativePush = (_s: unknown, _t: string, u?: string | null) => { calls.pushed.push(u); if (u != null) url.href = new URL(u, url.href).href; };
  const nativeReplace = (_s: unknown, _t: string, u?: string | null) => { calls.replaced.push(u); if (u != null) url.href = new URL(u, url.href).href; };
  const history = { pushState: nativePush, replaceState: nativeReplace };
  const location = {
    get href() { return url.href; },
    get hostname() { return url.hostname; },
    get host() { return url.host; },
    get origin() { return url.origin; },
    get pathname() { return url.pathname; },
    get search() { return url.search; },
    assign: (u: string) => calls.assign.push(u),
    replace: (u: string) => calls.replace.push(u),
    reload: () => { calls.reload += 1; },
  };
  const win: Record<string, unknown> = {
    URL,
    location,
    history,
    performance: { getEntriesByType: (type: string) => (type === "navigation" ? [{ name: began }] : []) },
    addEventListener: (type: string, fn: (e: object) => void, capture?: boolean) => (listeners[type] ??= []).push({ fn, capture: capture === true }),
  };
  win.document = {
    referrer,
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (el: { src: string; async: boolean }) => appended.push({ ...el, queued: (win.dataLayer as unknown[] | undefined)?.length ?? 0 }) },
  };
  win.window = win;
  runInNewContext(analyticsScript(), win);
  const dataLayer = ((win.dataLayer as ArrayLike<unknown>[] | undefined) ?? []).map((args) => Array.from(args));
  const fire = (type: string, event: object) => { for (const l of listeners[type] ?? []) l.fn(event); };
  const nav = (to: string) => { url.href = new URL(to, url.href).href; };
  return { win, calls, listeners, appended, dataLayer, history, nativePush, nativeReplace, fire, nav, off: () => win[`ga-disable-${GA_MEASUREMENT_ID}`] };
}

const ORIGIN = `https://${ANALYTICS_HOST}`;

describe("the script, on the production host", () => {
  it("sets the consent defaults, then config with the path alone, then loads gtag.js", () => {
    const b = run({ href: `${ORIGIN}/` });
    expect(b.dataLayer).toHaveLength(4);
    const [regional, global, js, config] = b.dataLayer;
    expect(regional).toEqual(["consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied", region: [...CONSENT_REGIONS] }]);
    expect(global).toEqual(["consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" }]);
    expect(js[0]).toBe("js");
    expect(config).toEqual(["config", GA_MEASUREMENT_ID, { page_location: `${ORIGIN}/`, cookie_domain: "none", allow_google_signals: false }]);
    // gtag.js is appended once, after every default is queued
    expect(b.appended).toEqual([{ src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`, async: true, queued: 4 }]);
    expect(typeof b.win.gtag).toBe("function");
  });

  it("the consent regions are the EEA, the UK and Switzerland", () => {
    expect([...CONSENT_REGIONS].sort()).toEqual(["AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MT", "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK"]);
  });

  it("never sends a query string (Auth.js's error and callbackUrl included) or a referrer's path; utm tags stay", () => {
    const callback = `${ORIGIN}/?error=OAuthCallback&callbackUrl=${encodeURIComponent("/app/search?q=from:alice")}&utm_source=hn&utm_campaign=launch`;
    const b = run({ href: callback, referrer: `${ORIGIN}/app/search?q=from%3Aalice` });
    expect(b.dataLayer[3][2]).toMatchObject({ page_location: `${ORIGIN}/?utm_source=hn&utm_campaign=launch`, page_referrer: `${ORIGIN}/` });
    expect(JSON.stringify(b.dataLayer)).not.toMatch(/alice|callbackUrl|OAuthCallback/);
    expect(run({ href: `${ORIGIN}/privacy`, referrer: "https://www.google.com/search?q=mailroom+gmail" }).dataLayer[3][2]).toMatchObject({ page_location: `${ORIGIN}/privacy`, page_referrer: "https://www.google.com/" });
    expect(run({ href: `${ORIGIN}/terms` }).dataLayer[3][2]).not.toHaveProperty("page_referrer");
  });

  it("does nothing on any other host, on an app page, or in a document that began in the app", () => {
    for (const opts of [
      { href: "https://email.kevinliu.studio/" },
      { href: "https://mailroom-tawny.vercel.app/" },
      { href: "https://mailroom-git-main-kl01s-projects.vercel.app/privacy" },
      { href: "http://localhost:3000/" },
      { href: `${ORIGIN}/app` },
      { href: `${ORIGIN}/app/search?q=x` },
      { href: `${ORIGIN}/og` },
      { href: `${ORIGIN}/privacy`, began: `${ORIGIN}/app/search?q=x` },
    ]) {
      const b = run(opts);
      expect(b.win.dataLayer, opts.href).toBeUndefined();
      expect(b.appended, opts.href).toEqual([]);
      expect(b.listeners, opts.href).toEqual({});
      expect(b.history.pushState, opts.href).toBe(b.nativePush);
    }
  });
});

describe("leaving the public pages is a full page load", () => {
  it("pushState or replaceState into the app becomes a navigation, with the tag switched off first", () => {
    const b = run({ href: `${ORIGIN}/` });
    b.history.pushState(null, "", "/privacy");
    expect(b.calls.pushed).toEqual(["/privacy"]); // between public pages: an ordinary SPA hop
    expect(b.off()).toBeUndefined();
    b.history.pushState({}, "", "/app/search?q=from:alice");
    expect(b.calls.pushed).toEqual(["/privacy"]);
    expect(b.calls.assign).toEqual([`${ORIGIN}/app/search?q=from:alice`]);
    expect(b.off()).toBe(true);
    b.history.replaceState({}, "", `${ORIGIN}/app`);
    expect(b.calls.replace).toEqual([`${ORIGIN}/app`]);
    expect(b.calls.replaced).toEqual([]);
    b.history.replaceState({ scroll: 1 }, ""); // a state-only update stays native
    expect(b.calls.replaced).toEqual([undefined]);
  });

  it("back or forward into the app reloads before anything else hears it", () => {
    const b = run({ href: `${ORIGIN}/terms` });
    expect(b.listeners.popstate?.map((l) => l.capture)).toEqual([true]);
    const quiet = { stopImmediatePropagation: vi.fn() };
    b.nav("/privacy");
    b.fire("popstate", quiet);
    expect(quiet.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(b.calls.reload).toBe(0);
    const out = { stopImmediatePropagation: vi.fn() };
    b.nav("/app/runs/abc");
    b.fire("popstate", out);
    expect(out.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(b.calls.reload).toBe(1);
    expect(b.off()).toBe(true);
  });

  it("a click on a link into the app goes to the browser, never the client router", () => {
    const b = run({ href: `${ORIGIN}/` });
    expect(b.listeners.click?.map((l) => l.capture)).toEqual([true]);
    const click = (href: string) => {
      const e = { target: { closest: () => ({ getAttribute: () => href }) }, stopPropagation: vi.fn() };
      b.fire("click", e);
      return e.stopPropagation.mock.calls.length;
    };
    expect(click("/app")).toBe(1);
    expect(click(`${ORIGIN}/app/search?q=x`)).toBe(1);
    expect(click("/api/auth/signin")).toBe(1);
    expect(click("/privacy")).toBe(0);
    expect(click("/#how")).toBe(0);
    expect(click("#search")).toBe(0);
    expect(click("https://github.com/Kevin-Liu-01/mailroom")).toBe(0);
    const bare = { target: { closest: () => null }, stopPropagation: vi.fn() };
    b.fire("click", bare);
    expect(bare.stopPropagation).not.toHaveBeenCalled();
  });

  it("runs once per document", () => {
    const b = run({ href: `${ORIGIN}/` });
    const wrapped = b.history.pushState;
    runInNewContext(analyticsScript(), b.win);
    expect(b.history.pushState).toBe(wrapped);
    expect(b.appended).toHaveLength(1);
  });

  it("is safe inline", () => {
    expect(analyticsScript()).not.toMatch(/<\/script|<!--/i);
  });
});

describe("the content security policy", () => {
  const APP_POLICY =
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://vitals.vercel-insights.com; frame-ancestors 'none'; form-action 'self' https://accounts.google.com; base-uri 'self'; object-src 'none'; upgrade-insecure-requests";
  const cspOf = (rules: { source: string; headers: { key: string; value: string }[] }[], source: string) =>
    rules.filter((r) => r.source === source || r.source === "/:path*").flatMap((r) => r.headers).filter((h) => h.key === "Content-Security-Policy").at(-1)?.value;

  it("adds GA's origins on the public pages of a production deployment; the app and the API keep the strict policy", async () => {
    expect(ANALYTICS_PAGES).toEqual([...ANALYTICS_PATHS]);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((r) => r.source)).toEqual(["/:path*", "/", "/privacy", "/terms"]);
    for (const page of ANALYTICS_PATHS) {
      const csp = cspOf(rules, page) ?? "";
      expect(csp, page).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;");
      expect(csp, page).toContain("connect-src 'self' https://vitals.vercel-insights.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com;");
      expect(csp.replace(" https://www.googletagmanager.com", "").replace(" https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com", ""), page).toBe(APP_POLICY);
    }
    expect(cspOf(rules, "/app/search")).toBe(APP_POLICY);
    expect(cspOf(rules, "/api/search")).toBe(APP_POLICY);
  });

  it("previews and the dev server get no GA origins anywhere", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const preview = (await nextConfig.headers?.()) ?? [];
    expect(preview.map((r) => r.source)).toEqual(["/:path*"]);
    expect(cspOf(preview, "/")).toBe(APP_POLICY);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    const dev = (await nextConfig.headers?.()) ?? [];
    expect(dev.map((r) => r.source)).toEqual(["/:path*"]);
    expect(cspOf(dev, "/")).toBeUndefined();
  });
});
