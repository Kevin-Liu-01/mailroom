/** The Gmail "M" in Google's four colors, drawn by hand so it can sit inline with text at any size. */
export function GmailMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M2 7.2v11.3c0 .8.7 1.5 1.5 1.5H6V9.9L2 7.2Z" />
      <path fill="#34A853" d="M18 20h2.5c.8 0 1.5-.7 1.5-1.5V7.2l-4 2.7V20Z" />
      <path fill="#FBBC04" d="M18 4.6v5.3l4-2.7V5.4c0-1.9-2.1-2.9-3.6-1.8L18 4.6Z" />
      <path fill="#EA4335" d="M6 9.9V4.6l6 4.5 6-4.5v5.3l-6 4.5-6-4.5Z" />
      <path fill="#C5221F" d="M2 5.4v1.8l4 2.7V4.6l-.4-.3C4.1 3.2 2 4.2 2 5.4Z" />
    </svg>
  );
}
