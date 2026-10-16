import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Crawl the public pages; the signed-in app and the API are nobody's search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app$", "/app/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
