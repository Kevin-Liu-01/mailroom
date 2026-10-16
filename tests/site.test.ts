import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { ANALYTICS_PATHS } from "@/lib/analytics";
import { PUBLIC_PAGES, SITE_URL, siteJsonLd } from "@/lib/site";

/** What search engines see: Mailroom's own mark as the icons, robots and the sitemap for the public pages, the JSON-LD. */

const APP = path.resolve(__dirname, "../src/app");

describe("icons", () => {
  it("favicon.ico is Mailroom's mark with a 48×48 image (Google wants a multiple of 48), not create-next-app's", () => {
    const ico = readFileSync(path.join(APP, "favicon.ico"));
    expect(createHash("md5").update(ico).digest("hex")).not.toBe("c30c7d42707a47a3f4591831641e50dc");
    expect(ico.readUInt16LE(2)).toBe(1);
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + 16 * i] || 256);
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("apple-icon.png is 180×180", () => {
    const png = readFileSync(path.join(APP, "apple-icon.png"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
  });
});

/** Google's robots matching: a rule is a path prefix, `$` anchors its end. */
const blocks = (rule: string, p: string) => (rule.endsWith("$") ? p === rule.slice(0, -1) : p.startsWith(rule));

describe("robots and the sitemap", () => {
  it("robots.txt points at the sitemap and keeps crawlers out of the app and the API, nothing else", () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const disallow = rules.flatMap((x) => x.disallow ?? []);
    for (const p of ["/app", "/app/search", "/api/search", "/api/auth/signin"]) expect(disallow.some((d) => blocks(d, p)), p).toBe(true);
    for (const p of [...PUBLIC_PAGES, "/apple-icon.png", "/favicon.ico", "/icon.svg", "/og.png", "/sitemap.xml"]) expect(disallow.some((d) => blocks(d, p)), p).toBe(false);
  });

  it("the sitemap lists exactly the public pages on the canonical origin", () => {
    expect(sitemap().map((e) => e.url)).toEqual(PUBLIC_PAGES.map((p) => `${SITE_URL}${p}`));
    expect([...PUBLIC_PAGES]).toEqual([...ANALYTICS_PATHS]);
    expect(SITE_URL).toBe("https://mailroom.kevinliu.studio");
  });
});

describe("the home page's JSON-LD", () => {
  it("names the WebSite and the Organization, with an absolute PNG logo", () => {
    const ld = JSON.parse(siteJsonLd());
    expect(ld["@context"]).toBe("https://schema.org");
    const byType = Object.fromEntries(ld["@graph"].map((n: { "@type": string }) => [n["@type"], n]));
    expect(byType.WebSite).toMatchObject({ name: "Mailroom", url: `${SITE_URL}/` });
    expect(byType.Organization).toMatchObject({ name: "Mailroom", url: `${SITE_URL}/`, logo: `${SITE_URL}/apple-icon.png` });
  });
});
