import { Search, Sparkles, Undo2 } from "lucide-react";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { SearchBox } from "@/components/app/SearchBox";
import { SearchResults } from "@/components/app/SearchResults";
import { SavedSearches } from "@/components/app/SavedSearches";
import { Empty, Meta, PageHead } from "@/components/app/Bits";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { q = "" } = await searchParams;
  const saved = await db.select().from(schema.savedSearches).where(eq(schema.savedSearches.userId, session.user.id)).orderBy(desc(schema.savedSearches.createdAt)).limit(20);
  return (
    <div className="section space-y-10">
      <PageHead icon={<Search size={26} />} title="Ask your mailbox in plain words">
        <Meta icon={Sparkles}>Jev turns it into a Gmail query you can edit</Meta>
        <Meta icon={Undo2}>every action on the results is undoable</Meta>
      </PageHead>
      <SearchBox initial={q} autoFocus={!q} />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>{q ? <SearchResults q={q} /> : <Empty icon={Search}>Type a question or pick a preset above.</Empty>}</div>
        <SavedSearches items={saved.map((s) => ({ id: s.id, name: s.name, naturalQuery: s.naturalQuery, gmailQuery: s.gmailQuery }))} />
      </div>
    </div>
  );
}
