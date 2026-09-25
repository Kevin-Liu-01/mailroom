import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

// The band inverts the page. Swapping the ink and page tokens keeps every control readable in both themes.
const outer = { "--band-ink": "var(--ink)", "--band-page": "var(--page)" } as CSSProperties;
const inner = {
  background: "var(--band-ink)",
  color: "var(--band-page)",
  "--ink": "var(--band-page)",
  "--page": "var(--band-ink)",
  "--inverse": "var(--band-ink)",
  "--panel": "color-mix(in srgb, var(--band-page) 8%, transparent)",
  "--surface": "color-mix(in srgb, var(--band-page) 12%, transparent)",
  "--line": "color-mix(in srgb, var(--band-page) 24%, transparent)",
  "--muted": "color-mix(in srgb, var(--band-page) 72%, transparent)",
  "--action-hover": "color-mix(in srgb, var(--band-page) 88%, var(--band-ink))",
} as CSSProperties;

export function ClosingBand({ cta }: { cta: ReactNode }) {
  return (
    <div style={outer}>
      <section id="connect" className="section flex flex-col items-center text-center" style={inner}>
        <BrandMark size={56} />
        <h2 className="mt-6 text-[clamp(32px,4.4vw,60px)] font-semibold leading-[1.12] tracking-[-0.04em]">
          Connect Gmail.
          <br />
          <span className="text-muted">Preview the first run.</span>
        </h2>
        <p className="mt-5 max-w-[520px] text-[17px] text-muted">Nothing changes until you press Apply. Every change after that has a receipt and an undo.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {cta}
          <a href="https://github.com/Kevin-Liu-01/mailroom" className="btn" target="_blank" rel="noreferrer">Read the source <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </section>
    </div>
  );
}
