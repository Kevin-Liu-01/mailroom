import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  title: "Mailroom: a sorting room for your Gmail",
  description: "Rules you can read, typed AI judgments that cost pennies, natural-language search, and a clear answer to what to trash. Every run previews first and can be undone.",
  metadataBase: new URL(url),
  openGraph: { title: "Mailroom", description: "A sorting room for your Gmail. Rules, cheap typed AI judgments, natural-language search, receipts and undo.", url, siteName: "Mailroom" },
};

function GitHubMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>
  );
}

const themeInit = `try{var t=localStorage.getItem('mailroom-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className={`${manrope.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className="min-h-screen antialiased">
        <header className="frame sticky top-0 z-50 flex min-h-[76px] items-center justify-between gap-4 border-b border-line bg-page px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-[19px] font-extrabold tracking-tight no-underline">
            <BrandMark /> Mailroom
          </Link>
          <nav className="hidden items-center gap-6 text-[15px] font-semibold text-muted md:flex">
            <Link href="/#how" className="no-underline hover:text-accent-deep">How it works</Link>
            <Link href="/#search" className="no-underline hover:text-accent-deep">Search</Link>
            <Link href="/#trash" className="no-underline hover:text-accent-deep">What to trash</Link>
            <Link href="/#policy" className="no-underline hover:text-accent-deep">The policy</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a className="btn" href="https://github.com/Kevin-Liu-01/mailroom" target="_blank" rel="noreferrer" aria-label="GitHub"><GitHubMark /><span className="hidden sm:inline">GitHub</span></a>
            {session?.user ? (
              <>
                <Link href="/app" className="btn-primary">Dashboard</Link>
                <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                  <button className="btn" type="submit">Sign out</button>
                </form>
              </>
            ) : null}
          </div>
        </header>
        <div className="frame hatch" />
        <main className="frame">{children}</main>
        <div className="frame hatch" />
        <footer className="frame flex flex-wrap items-center justify-between gap-3 px-6 py-6 text-[13px] text-muted">
          <span>Metadata only. Tokens encrypted at rest. Every run undoable. Nothing is ever sent or permanently deleted.</span>
          <span>Judgments by TypeSafe Jev · Built by Kevin Liu</span>
        </footer>
      </body>
    </html>
  );
}
