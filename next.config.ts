import type { NextConfig } from "next";

/**
 * Security headers for every response. The policy is strict about what runs or frames the app and permissive only
 * where the app needs it: inline styles (Tailwind and React set them), images from Gmail avatars over https, and the
 * Vercel runtime. These are part of the CASA evidence in docs/casa.md; change them with that document.
 *
 * Google Analytics 4 runs on the public pages alone (src/lib/analytics.ts), so only their policy names its origins
 * (img-src already allows https:). The signed-in app and the API keep the policy without them.
 */
function contentSecurityPolicy({ analytics }: { analytics: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${analytics ? " https://www.googletagmanager.com" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://vitals.vercel-insights.com${analytics ? " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy({ analytics: false }) },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** The public pages that measure: src/lib/analytics.ts ANALYTICS_PATHS (tests/analytics.test.ts pins the two). */
export const ANALYTICS_PAGES = ["/", "/privacy", "/terms"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // The dev server needs eval for Turbopack's HMR, so the CSP is a production header only.
    const production = process.env.NODE_ENV === "production";
    const headers = production ? securityHeaders : securityHeaders.filter((h) => h.key !== "Content-Security-Policy");
    // A later entry's header replaces an earlier one's on the same path: the public pages' policy adds GA's origins on
    // production deployments, where the tag is rendered at all.
    const analytics = production && process.env.VERCEL_ENV === "production" ? ANALYTICS_PAGES.map((source) => ({ source, headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy({ analytics: true }) }] })) : [];
    return [{ source: "/:path*", headers }, ...analytics];
  },
};

export default nextConfig;
