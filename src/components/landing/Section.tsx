import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CAMBER_BOLD, CAMBER_FALLBACK_EM } from "./type-metrics";

/** One line between two sections, with crop marks at both ends. */
export function Seam() {
  return (
    <div className="seam" aria-hidden="true">
      <i className="reticle reticle--l" />
      <i className="reticle reticle--r" />
    </div>
  );
}

export type Voice = "camber" | "mono";

/** How wide a line runs, in em: Camber from its measured advances, Berkeley Mono at 0.6em a character, plus tracking. */
export function emWidth(text: string, voice: Voice = "camber", tracking = -0.02): number {
  const glyphs = voice === "mono" ? text.length * 0.6 : [...text].reduce((w, ch) => w + (CAMBER_BOLD[ch] ?? CAMBER_FALLBACK_EM), 0);
  return glyphs + tracking * text.length;
}

/**
 * A heading that stays on one line at any width. The container's inline size sets the type size, scaled by the
 * line's length, so a long line runs smaller and a short one runs huge. Pass `em` when the children mix
 * typefaces or carry an icon; otherwise the width is measured from `text` in the chosen voice.
 */
export function FitLine({ as: Tag = "h2", text, em, voice = "camber", min = 17, max = 60, className = "", children }: {
  as?: "h1" | "h2"; text?: string; em?: number; voice?: Voice; min?: number; max?: number; className?: string; children?: ReactNode;
}) {
  const width = em ?? emWidth(text ?? "", voice);
  const fontSize = `clamp(${min}px, ${(96 / Math.max(width, 1)).toFixed(2)}cqw, ${max}px)`;
  return (
    <div className="w-full min-w-0" style={{ containerType: "inline-size" } as CSSProperties}>
      <Tag className={`m-0 leading-none ${voice === "mono" ? "font-mono" : ""} ${className}`} style={{ fontSize, whiteSpace: "nowrap", textWrap: "nowrap" } as CSSProperties}>{children ?? text}</Tag>
    </div>
  );
}

/** A section's opening: an icon tile, a one-line heading sized to the width it has, and one short lede. */
export function SectionHead({ icon: Icon, title, children, center = false }: { icon: LucideIcon; title: string; children?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "flex flex-col items-center text-center" : ""}>
      <span className="tile mb-6" aria-hidden="true"><Icon size={22} strokeWidth={2.2} /></span>
      <FitLine as="h2" text={title} className="font-bold tracking-[-0.02em]" />
      {children ? <p className="mt-5 max-w-[640px] text-[clamp(17px,1.5vw,21px)] leading-snug text-muted">{children}</p> : null}
    </div>
  );
}

/** A short claim with an icon, for the trust and cost cards. */
export function IconCard({ icon: Icon, children, className = "" }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <li className={`card flex items-start gap-4 ${className}`}>
      <span className="tile tile--sm" aria-hidden="true"><Icon size={18} strokeWidth={2.2} /></span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
