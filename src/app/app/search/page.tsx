import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { SearchBox } from "@/components/app/SearchBox";
import { SearchResults } from "@/components/app/SearchResults";
import { SavedSearches } from "@/components/app/SavedSearches";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { q = "" } = await searchParams;
  const saved = await db.select().from(schema.savedSearches).where(eq(schema.savedSearches.userId, session.user.id)).orderBy(desc(schema.savedSearches.createdAt)).limit(20);
  return (
    <div className="section space-y-6">
      <div>
        <Link href="/app" className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <p className="eyebrow mt-3">Search</p>
        <h1 className="text-3xl font-bold tracking-tight">Ask your mailbox in plain words</h1>
        <p className="max-w-2xl text-muted">Jev turns the sentence into typed parts, Mailroom writes the Gmail query, runs it, and ranks the results by the signal you asked for. Select results to archive, label, or trash; every action is undoable.</p>
      </div>
      <SearchBox initial={q} autoFocus={!q} />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>{q ? <SearchResults q={q} /> : <p className="card text-sm text-muted">Type a question or pick a preset above.</p>}</div>
        <SavedSearches items={saved.map((s) => ({ id: s.id, name: s.name, naturalQuery: s.naturalQuery, gmailQuery: s.gmailQuery }))} />
      </div>
    </div>
  );
}
