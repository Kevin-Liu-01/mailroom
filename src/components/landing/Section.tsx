import type { ReactNode } from "react";
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

/**
 * A section's opening: an icon tile, a two-line heading (the second line muted), and one short lede.
 * The heading size is tied to the viewport so the longest line still fits on one line on a phone.
 */
export function SectionHead({ icon: Icon, line1, line2, children, center = false }: { icon: LucideIcon; line1: string; line2: string; children?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "flex flex-col items-center text-center" : ""}>
      <span className="tile mb-6" aria-hidden="true"><Icon size={22} strokeWidth={2.2} /></span>
      <h2 className="text-[clamp(20px,6.5vw,56px)] font-bold leading-[1.06] tracking-[-0.02em]">
        {line1}
        <br />
        <span className="text-muted">{line2}</span>
      </h2>
      {children ? <p className={`mt-5 max-w-[640px] text-[clamp(17px,1.5vw,21px)] leading-snug text-muted`}>{children}</p> : null}
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
