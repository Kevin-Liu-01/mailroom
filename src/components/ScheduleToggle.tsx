"use client";
import { useState } from "react";

/** The daily-run switch. Compact enough to sit in a line of facts. */
export function ScheduleToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [saving, setSaving] = useState(false);
  async function toggle() {
    setSaving(true);
    const next = !on;
    const res = await fetch("/api/policy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduleEnabled: next }) });
    if (res.ok) setOn(next);
    setSaving(false);
  }
  return (
    <button type="button" role="switch" aria-checked={on} onClick={toggle} disabled={saving} className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[13.5px] text-muted hover:text-ink disabled:cursor-wait">
      <span className={`relative inline-flex h-[18px] w-[32px] items-center rounded-full border border-ink transition ${on ? "bg-ink" : "bg-page"}`}>
        <span className={`inline-block size-[12px] rounded-full transition ${on ? "translate-x-[15px] bg-page" : "translate-x-[2px] bg-ink"}`} />
      </span>
      <span>{saving ? "saving…" : on ? "daily run on · 13:00 UTC" : "daily run off"}</span>
    </button>
  );
}
