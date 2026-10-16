import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: path === "/" ? "weekly" : "yearly", priority: path === "/" ? 1 : 0.3 }));
}
