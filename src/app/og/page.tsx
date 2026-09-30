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
        <h1 className="absolute left-0 right-0 m-0 text-center font-semibold leading-none" style={{ top: 64, fontSize: 96, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
          Your <GmailMark className="ml-[.04em] mr-[.16em] inline-block h-[.88em] w-[.88em] align-[-.1em]" /><span className="gmail-word">Gmail,</span> sorted.
        </h1>
        <p className="absolute m-0 text-muted" style={{ left: 64, top: 290, width: 420, fontSize: 27, lineHeight: 1.3 }}>
          Rules you can read. Typed AI judgments for pennies. A straight answer to what to trash.
        </p>
        <div className="absolute flex items-center gap-3 font-mono text-[19px]" style={{ left: 64, bottom: 52 }}>
          <BrandMark size={30} /> mailroom.kevinliu.studio
        </div>
        <div className="absolute" style={{ right: 36, top: 196, width: 720 }}>
          <HeroScene />
        </div>
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
