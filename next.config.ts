import type { NextConfig } from "next";

/**
 * Security headers for every response. The policy is strict about what runs or frames the app and permissive only
 * where the app needs it: inline styles (Tailwind and React set them), images from Gmail avatars over https, and the
 * Vercel runtime. These are part of the CASA evidence in docs/casa.md; change them with that document.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://vitals.vercel-insights.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // The dev server needs eval for Turbopack's HMR, so the CSP is a production header only.
    const headers = process.env.NODE_ENV === "production" ? securityHeaders : securityHeaders.filter((h) => h.key !== "Content-Security-Policy");
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
