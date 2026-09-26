import { CATEGORIES, type CategoryId, type PolicyConfig } from "@/lib/policy/schema";
import { Brand, CATEGORY_BRANDS, Person } from "./Brand";

/*
 * The thirteen labels as cards: the name, the senders you would expect under it, and the one thing
 * the policy does with it. No descriptions; the marks do the explaining.
 */
type Labeled = Exclude<(typeof CATEGORIES)[number], { label: null }>;
const LABELED = CATEGORIES.filter((c): c is Labeled => c.id !== "other");
const PEOPLE = ["MK", "JR", "AL"];
const padding = { padding: "26px 24px 24px" };

function tagFor(id: CategoryId, policy: PolicyConfig): string {
  const { skipInbox, protected: protectedIds, neverImportant } = policy.categories;
  if (skipInbox.includes(id)) return "skips inbox";
  if (protectedIds.includes(id)) return "protected";
  if (neverImportant.includes(id)) return "not important";
  return "stays";
}

// Five tiles must fit a card at 320px wide, so they grow only where the card does.
function Tile({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span className="grid size-8 shrink-0 place-items-center rounded-[6px] border border-line bg-surface text-ink sm:size-9 lg:size-10" title={title}>{children}</span>;
}

export function LabelGrid({ policy }: { policy: PolicyConfig }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {LABELED.map((c) => {
        const tag = tagFor(c.id, policy);
        const marks = (CATEGORY_BRANDS[c.id] ?? []).slice(0, 5);
        return (
          <li key={c.id} className="card flex min-w-0 flex-col gap-5" style={padding}>
            <div className="flex items-start justify-between gap-3">
              <span className="display min-w-0 text-[22px] leading-tight">{c.label}</span>
              <span className={`chip shrink-0 ${tag === "skips inbox" ? "chip--accent" : ""}`}>{tag}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-1.5 lg:gap-2" aria-label={c.id === "personal" ? "People who write to you" : `Senders labeled ${c.label}`}>
              {c.id === "personal"
                ? PEOPLE.map((p) => <Tile key={p}><Person initials={p} size={22} /></Tile>)
                : marks.map((id) => <Tile key={id}><Brand id={id} size={16} className="size-4 lg:size-5" /></Tile>)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
