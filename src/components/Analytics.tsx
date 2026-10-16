import Script from "next/script";
import { auth } from "@/auth";
import { analyticsEnabled, analyticsScript } from "@/lib/analytics";

/**
 * Google Analytics 4 for a public page (src/lib/analytics.ts): rendered by the landing, /privacy and /terms alone, and
 * only in production for a visitor who is signed out. The app's layout and pages never render it
 * (tests/analytics.test.ts).
 */
export async function Analytics() {
  if (!analyticsEnabled()) return null;
  if ((await auth())?.user) return null;
  return (
    <Script id="mailroom-ga" strategy="afterInteractive">
      {analyticsScript()}
    </Script>
  );
}
