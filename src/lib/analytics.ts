/**
 * Google Analytics 4 on Mailroom's public pages, and nowhere else: the landing, the privacy page and the terms, for a
 * visitor who is signed out (src/components/Analytics.tsx). Never in the signed-in app, never on an API route, never on
 * anything that shows, searches or files mail. tests/analytics.test.ts pins where the tag can appear.
 *
 * The page carries one inline script (`analyticsScript`), which in order:
 *   1. stops unless the page is on the production host and this document began on a public page, so a preview, an
 *      alias, localhost, or an app tab that moved to /privacy never loads the tag;
 *   2. makes every way out of the public pages a full page load (links, history.pushState/replaceState, back and
 *      forward), so gtag.js never sees an app URL, its query string or its title;
 *   3. sets the Consent Mode v2 defaults before the tag loads (ads denied everywhere; analytics storage denied in the
 *      EEA, the UK and Switzerland), then configures GA with the page's path alone (utm_* tags kept, so `?error=` and
 *      `?callbackUrl=` never leave), a referrer cut to its origin, a cookie for this host only and Google signals off;
 *   4. loads gtag.js. SPA hops between the public pages are GA4's enhanced measurement (history events).
 */

/** GA4's web stream for mailroom.kevinliu.studio. Public by design: it ships in every page that measures. */
export const GA_MEASUREMENT_ID = "G-QXXZK16XLJ";

/** The one host that measures. Vercel aliases (email.kevinliu.studio, *.vercel.app) and previews never do. */
export const ANALYTICS_HOST = "mailroom.kevinliu.studio";

/** The public pages, the only paths that ever load the tag. next.config.ts repeats the list for their CSP. */
export const ANALYTICS_PATHS = ["/", "/privacy", "/terms"] as const;

/** Consent Mode's region list for the stricter default: the EEA, the UK and Switzerland. */
export const CONSENT_REGIONS = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH", "GB"] as const;

type Env = Readonly<Record<string, string | undefined>>;

/** Production deployments only: previews, `next dev` and tests never render the tag. */
export function analyticsEnabled(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production";
}

export function isAnalyticsPath(pathname: string): boolean {
  return (ANALYTICS_PATHS as readonly string[]).includes(pathname);
}

/** The inline script a public page runs (see the module comment). Plain ES2017; it fails closed on any error. */
export function analyticsScript(): string {
  const id = JSON.stringify(GA_MEASUREMENT_ID);
  return `(function () {
  try {
    var w = window, d = document, l = location, h = history, P = ${JSON.stringify(ANALYTICS_PATHS)};
    if (l.hostname !== ${JSON.stringify(ANALYTICS_HOST)} || w.__mailroomGa) return;
    var pub = function (p) { return P.indexOf(p) >= 0; };
    var nav = w.performance && performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
    var began = nav && nav.name ? new URL(nav.name).pathname : l.pathname;
    if (!pub(began) || !pub(l.pathname)) return;
    w.__mailroomGa = 1;
    var off = "ga-disable-" + ${id};
    var away = function (u) {
      try { var t = new URL(u, l.href); return t.origin === l.origin && !pub(t.pathname) ? t.href : null; } catch (e) { return null; }
    };
    ["pushState", "replaceState"].forEach(function (m) {
      var f = h[m];
      h[m] = function (s, t, u) {
        var to = u == null ? null : away(String(u));
        if (to) { w[off] = true; if (m === "pushState") l.assign(to); else l.replace(to); return; }
        return f.apply(this, arguments);
      };
    });
    w.addEventListener("popstate", function (e) {
      if (pub(l.pathname)) return;
      w[off] = true; e.stopImmediatePropagation(); l.reload();
    }, true);
    w.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (a && away(a.getAttribute("href"))) e.stopPropagation();
    }, true);
    w.dataLayer = w.dataLayer || [];
    var gtag = w.gtag = function () { w.dataLayer.push(arguments); };
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied", region: ${JSON.stringify(CONSENT_REGIONS)} });
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    gtag("js", new Date());
    var utm = l.search.slice(1).split("&").filter(function (kv) { return /^utm_[a-z_]+=/i.test(kv); }).join("&");
    var c = { page_location: l.origin + l.pathname + (utm ? "?" + utm : ""), cookie_domain: "none", allow_google_signals: false };
    if (d.referrer) {
      try { var r = new URL(d.referrer); c.page_referrer = r.host === l.host ? l.origin + "/" : r.protocol + "//" + r.host + "/"; } catch (e) { c.page_referrer = l.origin + "/"; }
    }
    gtag("config", ${id}, c);
    var s = d.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + ${id};
    d.head.appendChild(s);
  } catch (e) {}
})();`;
}
