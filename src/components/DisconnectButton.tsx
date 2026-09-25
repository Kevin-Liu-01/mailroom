"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    if (!confirm("Disconnect Gmail and delete everything Mailroom stores about you? Your Gmail labels and mail are untouched.")) return;
    setBusy(true);
    await fetch("/api/disconnect", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return <button className="btn-danger" disabled={busy} onClick={disconnect}>{busy ? "Removing…" : "Disconnect and delete my data"}</button>;
}
