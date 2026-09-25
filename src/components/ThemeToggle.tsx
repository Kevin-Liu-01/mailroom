"use client";
import { useSyncExternalStore } from "react";

const EVENT = "mailroom-theme";
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
const read = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Two-state ink/paper dial: a half-filled circle that flips. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light");
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("mailroom-theme", next); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }
  return (
    <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to paper" : "Switch to ink"} title={theme === "dark" ? "paper" : "ink"} className="btn" style={{ width: 42, padding: 0 }}>
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d={theme === "dark" ? "M10 2.5a7.5 7.5 0 0 0 0 15z" : "M10 2.5a7.5 7.5 0 0 1 0 15z"} fill="currentColor" />
      </svg>
    </button>
  );
}
