"use client";
import { useState } from "react";

export function DisconnectButton() {
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    if (!confirm("Disconnect Gmail and delete everything Mailroom stores about you? Your Gmail labels and mail are untouched.")) return;
    setBusy(true);
    await fetch("/api/disconnect", { method: "POST" });
    window.location.href = "/";
  }
  return <button className="btn border-red-500/40 text-red-600 dark:text-red-400" disabled={busy} onClick={disconnect}>{busy ? "Removing…" : "Disconnect and delete my data"}</button>;
}
