/**
 * Demo privacy. One switch hides every email address the app shows, so a screen recording or a shared screen never
 * carries an inbox address. A cookie carries the switch, so server-rendered pages arrive hidden from the first byte.
 */
export const HIDE_EMAILS_COOKIE = "mailroom_hide_emails";
export const MASK = "•••••";

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

/** Every email address in `text` with the part before the @ hidden. The domain stays, so a demo still reads. */
export function maskEmails(text: string): string {
  return text.replace(EMAIL, (_match, domain: string) => `${MASK}@${domain}`);
}

/** `text` as the switch says to show it. */
export function maskIf(hidden: boolean, text: string | null | undefined): string {
  if (!text) return "";
  return hidden ? maskEmails(text) : text;
}
