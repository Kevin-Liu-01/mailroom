/** The canonical origin search engines are told about (robots.txt, the sitemap, the home page's JSON-LD). */
export const SITE_URL = "https://mailroom.kevinliu.studio";

/** The public pages: what the sitemap lists. Everything under /app and /api is signed in or machine-only. */
export const PUBLIC_PAGES = ["/", "/privacy", "/terms"] as const;

/** The home page's structured data: the site and its publisher, with the 180 px mark (src/app/apple-icon.png) as the logo. */
export function siteJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Mailroom", url: `${SITE_URL}/`, publisher: { "@id": `${SITE_URL}/#organization` } },
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Mailroom", url: `${SITE_URL}/`, logo: `${SITE_URL}/apple-icon.png` },
    ],
  });
}
