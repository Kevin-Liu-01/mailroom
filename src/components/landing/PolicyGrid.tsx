import { Archive, AtSign, BadgePercent, Briefcase, CalendarDays, Contact, GitPullRequestArrow, GraduationCap, KeyRound, Landmark, MailOpen, Newspaper, Plane, Receipt, Tag, Trash, TrendingDown, UserRound, type LucideIcon } from "lucide-react";
import { CATEGORIES, LABEL_BY_CATEGORY, type CategoryId, type PolicyConfig } from "@/lib/policy/schema";

const ICONS: Partial<Record<CategoryId, LucideIcon>> = {
  work: Briefcase,
  personal: UserRound,
  finance: Landmark,
  receipts: Receipt,
  travel: Plane,
  events: CalendarDays,
  recruiting: Contact,
  school: GraduationCap,
  dev: GitPullRequestArrow,
  social: AtSign,
  newsletters: Newspaper,
  marketing: BadgePercent,
  security: KeyRound,
};

export function labelsFor(ids: readonly CategoryId[]): string[] {
  return ids.flatMap((id) => { const label = LABEL_BY_CATEGORY[id]; return label ? [label] : []; });
}

export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function PolicyGrid({ policy }: { policy: PolicyConfig }) {
  const { skipInbox, neverImportant, protected: protectedIds } = policy.categories;
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORIES.filter((c) => c.label).map((c) => {
        const Icon = ICONS[c.id] ?? Tag;
        const [tag, chip] = skipInbox.includes(c.id) ? ["skips inbox", "chip"]
          : protectedIds.includes(c.id) ? ["protected", "chip chip--accent"]
          : neverImportant.includes(c.id) ? ["not important", "chip"]
          : ["stays", "chip"];
        return (
          <li key={c.id} className="card flex gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[6px] border border-line bg-surface text-ink"><Icon size={19} aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-bold">{c.label}</span>
                <span className={chip}>{tag}</span>
              </span>
              <span className="mt-1 block text-[14px] leading-snug text-muted">{c.description}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type Row = { icon: LucideIcon; kind: string; text: string };

export function AgingRules({ policy }: { policy: PolicyConfig }) {
  const a = policy.aging;
  const rows: Row[] = [
    { icon: Archive, kind: "archive", text: `${listOf(labelsFor(policy.categories.skipInbox))} mail still in the inbox leaves after ${a.archiveStragglersAfterDays} days.` },
  ];
  if (a.trashSecurityCodesAfterDays !== null) rows.push({ icon: Trash, kind: "trash", text: `Verification codes and sign-in alerts go to Trash after ${a.trashSecurityCodesAfterDays} days.` });
  if (a.trashDevAfterDays !== null) rows.push({ icon: Trash, kind: "trash", text: `Dev notifications go to Trash after ${a.trashDevAfterDays} days.` });
  if (a.trashSocialAfterDays !== null) rows.push({ icon: Trash, kind: "trash", text: `Social notifications go to Trash after ${a.trashSocialAfterDays} days.` });
  if (a.markReadPromotionsAfterDays !== null) rows.push({ icon: MailOpen, kind: "read", text: `Unread promotions are marked read after ${a.markReadPromotionsAfterDays} days.` });
  rows.push({ icon: TrendingDown, kind: "demote", text: "Heavy promotional senders lose the important marker and get the Marketing & Deals label." });
  return (
    <div className="card">
      <h3 className="text-[17px] font-bold">What the daily pass does</h3>
      <ul className="m-0 mt-3 list-none space-y-2.5 p-0">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-3 text-[14.5px]">
            <span className="chip chip--accent mt-0.5 shrink-0"><r.icon size={12} aria-hidden="true" />{r.kind}</span>
            <span className="text-muted">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
