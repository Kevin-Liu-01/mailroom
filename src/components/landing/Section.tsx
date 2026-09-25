import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** A hatch band with crop marks at its corners, the seam between two sections. */
export function ReticleSpacer() {
  return (
    <div className="hatch" aria-hidden="true">
      <i className="reticle reticle--tl" />
      <i className="reticle reticle--tr" />
      <i className="reticle reticle--bl" />
      <i className="reticle reticle--br" />
    </div>
  );
}

export function SectionHeading({ eyebrow, title, accent, children }: { eyebrow: string; title: string; accent: string; children?: ReactNode }) {
  return (
    <header className="mb-9 grid gap-5 lg:mb-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)] lg:items-end lg:gap-12">
      <div>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h2 className="text-[clamp(30px,3.7vw,52px)] font-bold leading-[1.1] tracking-[-0.04em]">
          {title}
          <br />
          <span className="text-muted">{accent}</span>
        </h2>
      </div>
      {children ? <p className="max-w-[480px] text-[17px] leading-relaxed text-muted lg:mb-1 lg:text-[18px]">{children}</p> : null}
    </header>
  );
}

export function Proof({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2 text-[15px] text-muted">
      <Icon size={17} className="shrink-0 text-ink" aria-hidden="true" />
      {children}
    </li>
  );
}

export function Fact({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="card">
      <span className="grid size-10 place-items-center rounded-[6px] border border-line bg-surface text-ink"><Icon size={19} aria-hidden="true" /></span>
      <h3 className="mt-4 text-[17px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[14.5px] leading-snug text-muted">{children}</p>
    </div>
  );
}
