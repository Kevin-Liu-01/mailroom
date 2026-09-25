"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshStats({ label = "Refresh numbers" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function refresh() { setBusy(true); await fetch("/api/stats", { method: "POST" }); setBusy(false); router.refresh(); }
  return <button className="btn btn-sm" disabled={busy} onClick={refresh}><RefreshCw size={13} className={busy ? "animate-spin" : ""} /> {busy ? "Counting…" : label}</button>;
}
