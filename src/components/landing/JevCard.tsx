import type { CSSProperties } from "react";
import { ArrowUpRight, Ban, Binary, ListChecks, Coins } from "lucide-react";
import { TypeSafeLockup, TypeSafeMark } from "./TypeSafeMark";
import { USD_PER_INPUT_TOKEN } from "@/lib/ai/triage";

/**
 * Who Jev is, as a spec plate: the maker's mark, the name in display type, four facts in label/value rows
 * (Camber labels, mono values), and two quiet links. No paragraph.
 */
const ROWS: { icon: typeof Ban; label: string; value: string }[] = [
  { icon: Ban, label: "Writes", value: "Never" },
  { icon: Binary, label: "Answers", value: "Typed. A probability, not prose." },
  { icon: ListChecks, label: "Per email", value: "5 questions · metadata only" },
  { icon: Coins, label: "Costs", value: `$${(USD_PER_INPUT_TOKEN * 1_000_000).toFixed(3)} per million tokens` },
];

export function JevCard() {
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-4 border-b border-line px-5 py-4">
        <span className="tile tile--lg tile--tone" style={{ "--tone": "var(--c-purple)" } as CSSProperties} aria-hidden="true"><TypeSafeMark size={30} /></span>
        <div className="min-w-0">
          <div className="display text-[clamp(28px,2.6vw,36px)] leading-none">Jev</div>
          <div className="mt-1.5 font-mono text-[11.5px] font-bold uppercase tracking-[.12em] text-muted">System One model · TypeSafe AI</div>
        </div>
      </div>
      <ul className="m-0 list-none p-0">
        {ROWS.map(({ icon: Icon, label, value }) => (
          <li key={label} className="grid grid-cols-[auto_88px_minmax(0,1fr)] items-center gap-3 border-b border-line px-5 py-3 text-[14px]">
            <Icon size={15} className="text-muted" aria-hidden="true" />
            <span className="text-muted">{label}</span>
            <span className="font-mono text-[13px]">{value}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[13px]">
        <a href="https://typesafe.ai" target="_blank" rel="noreferrer" className="inline-flex text-ink" aria-label="TypeSafe AI"><TypeSafeLockup height={16} /></a>
        <a href="https://docs.typesafe.ai/concepts/system-one" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink no-underline hover:underline">How System One works <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
    </div>
  );
}
