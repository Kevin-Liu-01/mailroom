// A postal "stamp" mark: framed square with an envelope fold and a sorting tick, in the lsearch badge spirit.
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 40 31" aria-hidden="true" fill="none" style={{ color: "var(--ink)" }}>
      <rect x="1" y="1" width="38" height="29" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M7 9h26l-13 9L7 9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 9v13h26V9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 24l3 3 6-6" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
