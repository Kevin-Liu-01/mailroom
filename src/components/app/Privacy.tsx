"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { emWidth, FitLine } from "@/components/landing/Section";
import { HIDE_EMAILS_COOKIE, maskEmails } from "@/lib/privacy";

const HideEmails = createContext<{ hidden: boolean; setHidden: (hidden: boolean) => void }>({ hidden: false, setHidden: () => {} });

/**
 * Holds the hide-emails switch for every page in the app. The server reads the same cookie, so a page loads already
 * hidden; flipping the switch updates every address on screen at once, with no round trip.
 */
export function PrivacyProvider({ initial, children }: { initial: boolean; children: ReactNode }) {
  const [hidden, set] = useState(initial);
  const setHidden = useCallback((next: boolean) => {
    set(next);
    document.cookie = `${HIDE_EMAILS_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return <HideEmails.Provider value={{ hidden, setHidden }}>{children}</HideEmails.Provider>;
}

/** Whether email addresses are hidden right now. */
export function useHideEmails(): boolean {
  return useContext(HideEmails).hidden;
}

/** Shows `text` as the switch says: email addresses in it keep only their domain while hidden. */
export function useMask(): (text: string | null | undefined) => string {
  const hidden = useHideEmails();
  return useCallback((text: string | null | undefined) => (text ? (hidden ? maskEmails(text) : text) : ""), [hidden]);
}

/** The eye beside the account address: hides or shows every email address in the app, for demos. */
export function EyeToggle() {
  const { hidden, setHidden } = useContext(HideEmails);
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button type="button" className="btn btn-sm shrink-0" style={{ width: 34, padding: 0 }} onClick={() => setHidden(!hidden)}
      aria-pressed={hidden} aria-label={hidden ? "Show email addresses" : "Hide email addresses"} title={hidden ? "Show emails" : "Hide emails"}>
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

/** Text that may hold email addresses, for server-rendered pages: it follows the switch the moment it flips. */
export function Masked({ text, fallback = "" }: { text: string | null | undefined; fallback?: string }) {
  const mask = useMask();
  return <>{mask(text) || fallback}</>;
}

/** The dashboard's heading: the account address on one line, with the eye right after it. */
export function AccountHeading({ email }: { email: string }) {
  const hidden = useHideEmails();
  const shown = hidden ? maskEmails(email) : email;
  return (
    <FitLine as="h1" text={shown} em={emWidth(shown) + 2} min={18} max={40} className="font-semibold tracking-[-0.02em]">
      <span className="inline-flex items-center gap-3">{shown}<EyeToggle /></span>
    </FitLine>
  );
}
