import { NextResponse, type NextRequest } from "next/server";

/**
 * Cross-site request forgery guard for the app's own API. State-changing requests must come from this origin:
 * a browser always sends `Origin` on cross-site POSTs, so a mismatch is rejected before any handler runs. Auth.js
 * carries its own CSRF token and the cron route is called by Vercel with a bearer secret, so both are left alone.
 */
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  if (SAFE.has(req.method)) return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/auth") || path.startsWith("/api/cron")) return NextResponse.next();
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: "cross-site request refused" }, { status: 403 });
    } catch {
      return NextResponse.json({ error: "bad origin" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
