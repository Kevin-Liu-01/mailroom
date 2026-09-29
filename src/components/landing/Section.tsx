import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** One line between two sections, with crop marks at both ends. */
export function Seam() {
  return (
    <div className="seam" aria-hidden="true">
      <i className="reticle reticle--l" />
      <i className="reticle reticle--r" />
    </div>
  );
}

/** How wide a line of Berkeley Mono runs, in em: 0.6em per character, less the heading's tracking. */
export const emWidth = (text: string, tracking = 0.02) => text.length * (0.6 - tracking);

/**
 * A heading that stays on one line at any width. The container's inline size sets the type size, scaled by the
 * line's length, so a long line runs smaller and a short one runs huge. Pass `em` when the children mix
 * typefaces or carry an icon; otherwise the width is measured from `text`.
 */
export function FitLine({ as: Tag = "h2", text, em, min = 17, max = 60, className = "", children }: {
  as?: "h1" | "h2"; text?: string; em?: number; min?: number; max?: number; className?: string; children?: ReactNode;
}) {
  const width = em ?? emWidth(text ?? "");
  const fontSize = `clamp(${min}px, ${(96 / Math.max(width, 1)).toFixed(2)}cqw, ${max}px)`;
  return (
    <div className="w-full min-w-0" style={{ containerType: "inline-size" } as CSSProperties}>
      <Tag className={`m-0 leading-none ${className}`} style={{ fontSize, whiteSpace: "nowrap", textWrap: "nowrap" } as CSSProperties}>{children ?? text}</Tag>
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
