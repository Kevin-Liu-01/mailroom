"use client";
import { useState } from "react";

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
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? "bg-accent" : "bg-border"}`} onClick={toggle} role="switch" aria-checked={on}>
        <span className={`inline-block h-5 w-5 rounded-full bg-card shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
      <span>{saving ? "Saving…" : on ? "Daily run is on (13:00 UTC)" : "Daily run is off"}</span>
    </label>
  );
}
