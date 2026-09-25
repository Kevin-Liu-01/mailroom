"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, X } from "lucide-react";

export function SavedSearches({ items }: { items: { id: string; name: string; naturalQuery: string; gmailQuery: string }[] }) {
  const router = useRouter();
  async function remove(id: string) {
    await fetch("/api/searches", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  }
  return (
    <aside className="card card--surface space-y-3 self-start">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Bookmark size={15} /> Saved searches</h2>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <Link href={`/app/search?q=${encodeURIComponent(s.naturalQuery)}`} className="min-w-0 flex-1 no-underline hover:text-accent-deep">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="mono block truncate text-[11.5px] text-muted">{s.gmailQuery}</span>
              </Link>
              <button className="text-muted hover:text-danger" onClick={() => remove(s.id)} aria-label="Delete saved search"><X size={14} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">Save any search from the results panel and it shows up here.</p>}
    </aside>
  );
}
