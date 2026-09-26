import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import Script from "next/script";
import { Database, Lock, ShieldOff, Undo2 } from "lucide-react";
import { auth, signOut } from "@/auth";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import { GmailMark } from "@/components/GmailMark";
import { SignInButton } from "@/components/SignInButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

// Berkeley Mono is the only typeface on the site. Licensed copy, self-hosted.
const berkeley = localFont({
  src: [
    { path: "./fonts/BerkeleyMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/BerkeleyMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-berkeley",
  display: "swap",
});

const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  title: "mailroom",
  verification: { google: "3rhZfQGUOEb4MxiPhacvNbcB513B-hB2IxA-UPef4TY" },
  description: "A sorting room for your Gmail. Rules you can read, typed AI judgments that cost pennies, natural-language search, and a straight answer to what to trash. Every run previews first and can be undone.",
  metadataBase: new URL(url),
  openGraph: { title: "mailroom", description: "A sorting room for your Gmail: rules, cheap typed AI judgments, natural-language search, receipts and undo.", url, siteName: "mailroom" },
  twitter: { card: "summary_large_image", title: "mailroom", description: "A sorting room for your Gmail." },
};

const themeInit = `try{var t=localStorage.getItem('mailroom-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>
  );
}

const claim = "inline-flex items-center gap-1.5 whitespace-nowrap";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className={berkeley.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Script id="mailroom-theme-init" strategy="beforeInteractive">{themeInit}</Script>
        <header className="frame sticky top-0 z-50 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-line bg-page px-4 py-2 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="mailroom home">
            <BrandMark size={28} /> <Wordmark />
          </Link>
          <nav className="hidden items-center gap-6 text-[12px] font-bold uppercase tracking-[.14em] text-muted md:flex">
            <Link href="/#how" className="no-underline hover:text-ink">How it works</Link>
            <Link href="/#search" className="no-underline hover:text-ink">Search</Link>
            <Link href="/#trash" className="no-underline hover:text-ink">What to trash</Link>
            <Link href="/#policy" className="no-underline hover:text-ink">Policy</Link>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <a className="btn" href="https://github.com/Kevin-Liu-01/mailroom" target="_blank" rel="noreferrer" aria-label="GitHub"><GitHubMark /><span className="hidden sm:inline">GitHub</span></a>
            {session?.user ? (
              <>
                <Link href="/app" className="btn-primary"><GmailMark size={16} /> Dashboard</Link>
                <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                  <button className="btn" type="submit">Sign out</button>
                </form>
              </>
            ) : (
              <SignInButton label="Connect Gmail" />
            )}
          </div>
        </header>
        <main className="frame">{children}</main>
        <footer className="frame flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-6 py-5 text-[12.5px] text-muted">
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0">
            <li className={claim}><BrandMark size={16} /> mailroom</li>
            <li className={claim}><Database size={13} aria-hidden="true" /> metadata only</li>
            <li className={claim}><Lock size={13} aria-hidden="true" /> tokens encrypted at rest</li>
            <li className={claim}><Undo2 size={13} aria-hidden="true" /> every run undoable</li>
            <li className={claim}><ShieldOff size={13} aria-hidden="true" /> never sent, never deleted for good</li>
          </ul>
          <span className="flex flex-wrap items-center gap-3"><Link href="/privacy" className="hover:text-ink">privacy</Link><Link href="/terms" className="hover:text-ink">terms</Link><span>judgments by TypeSafe Jev · built by Kevin Liu</span></span>
        </footer>
      </body>
    </html>
  );
}
