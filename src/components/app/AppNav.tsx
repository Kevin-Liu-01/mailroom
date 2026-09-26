"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, SlidersHorizontal, Trash2, Users } from "lucide-react";

const TABS = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/trash", label: "What to trash", icon: Trash2 },
  { href: "/app/senders", label: "Senders", icon: Users },
  { href: "/app/policy", label: "Policy", icon: SlidersHorizontal },
];

/** The dashboard's tab row. Runs live under Overview. */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex flex-wrap gap-1 border-b border-line px-[var(--gutter)] py-3">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href || pathname.startsWith("/app/runs") : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`tab ${active ? "tab--active" : ""}`}>
            <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
