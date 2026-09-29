/**
 * The Mailroom mark: a wall of pigeonholes with one letter slotted in. Pure ink, reads at 16px.
 * `size` is the rendered width; the mark is square.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className} style={{ color: "var(--ink)" }}>
      <rect x="1.5" y="1.5" width="37" height="37" rx="3" fill="var(--page)" stroke="currentColor" strokeWidth="2.5" />
      <path d="M13.5 1.5v37M26.5 1.5v37M1.5 13.5h37M1.5 26.5h37" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="13.5" width="13" height="13" fill="currentColor" />
      <rect x="15.75" y="16.25" width="8.5" height="7.5" rx=".6" fill="var(--page)" />
      <path d="M15.75 16.9l4.25 3.1 4.25-3.1" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ withCursor = true }: { withCursor?: boolean }) {
  return (
    <span className={`font-mono text-[17px] font-bold tracking-[.02em] ${withCursor ? "cursor" : ""}`}>mailroom</span>
  );
}
