import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mailroom",
  description: "An opinionated Gmail suite: deterministic rules plus cheap typed AI judgments keep your inbox sorted, for about four cents per thousand emails.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> Mailroom
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted">
              <Link href="/#how" className="hover:text-foreground">How it works</Link>
              <Link href="/#policy" className="hover:text-foreground">The policy</Link>
              <Link href="/#cost" className="hover:text-foreground">Cost</Link>
              {session?.user ? (
                <>
                  <Link href="/app" className="text-foreground hover:text-accent">Dashboard</Link>
                  <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                    <button className="hover:text-foreground">Sign out</button>
                  </form>
                </>
              ) : null}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted">
            <span>Mailroom reads email metadata only, encrypts your Google token at rest, and every run can be undone.</span>
            <span>Judgments by TypeSafe Jev. Built by Kevin Liu.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
