import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { GmailMark } from "@/components/GmailMark";
import { HeroScene } from "@/components/landing/HeroScene";

export const metadata: Metadata = { title: "Mailroom · OG", robots: { index: false, follow: false } };

/**
 * The OpenGraph card, laid out at exactly 1200×630 and painted dark with the theme's own tokens inline, so a
 * screenshot of this box is the share image. `public/og.png` is captured from here; see docs/og.md.
 */
export default function OgPage() {
  return (
    <div className="my-16 flex justify-center overflow-x-auto">
      <div
        id="og"
        className="relative shrink-0 overflow-hidden"
        style={{ width: 1200, minWidth: 1200, height: 630, background: "var(--page)", color: "var(--ink)", outline: "4px solid #ff00ff", outlineOffset: 0, ...DARK }}
      >
        <div className="dither" aria-hidden="true" />
        {/* left: the name, a three-line headline, one line of lede, the address */}
        <div className="absolute flex items-center gap-3" style={{ left: 72, top: 58 }}>
          <BrandMark size={34} />
          <span className="font-mono text-[22px] font-bold tracking-[.02em]">mailroom</span>
        </div>
        <h1 className="absolute m-0 font-semibold" style={{ left: 66, top: 126, fontSize: 108, lineHeight: 0.98, letterSpacing: "0.005em", whiteSpace: "nowrap" }}>
          Your
          <br />
          <GmailMark className="mr-[.14em] inline-block h-[.84em] w-[.84em] align-[-.08em]" /><span className="gmail-word">Gmail,</span>
          <br />
          sorted.
        </h1>
        <p className="absolute m-0 text-muted" style={{ left: 72, top: 474, width: 470, fontSize: 23, lineHeight: 1.3 }}>
          Rules you can read. Typed AI judgments for pennies. A straight answer to what to trash.
        </p>
        <div className="absolute font-mono text-[17px] text-muted" style={{ left: 72, bottom: 42 }}>mailroom.kevinliu.studio</div>
        {/* right: the machine, with the three beats under it */}
        <div className="absolute" style={{ left: 612, top: 150, width: 556 }}>
          <HeroScene />
        </div>
        <div className="absolute font-mono text-[12px] font-bold uppercase tracking-[.16em] text-muted" style={{ right: 72, bottom: 46 }}>Rules · Jev · Receipt</div>
      </div>
    </div>
  );
}

const DARK = {
  "--page": "#000000",
  "--ink": "#f4f4f4",
  "--muted": "#9b9b9b",
  "--line": "#2b2b2b",
  "--surface": "#141414",
  "--panel": "#0a0a0a",
  "--inverse": "#000000",
  "--action-hover": "#d9d9d9",
  "--accent": "#f4f4f4",
  "--accent-soft": "#1e1e1e",
  "--accent-deep": "#f4f4f4",
  "--warn": "#f4f4f4",
  "--warn-soft": "#1e1e1e",
  "--danger": "#f4f4f4",
  "--danger-soft": "#1e1e1e",
  "--brand-lift": "82%",
  "--brand-sink": "0%",
  "--c-blue": "#60a5fa",
  "--c-green": "#4ade80",
  "--c-amber": "#fbbf24",
  "--c-red": "#f87171",
  "--c-purple": "#a78bfa",
} as React.CSSProperties;
