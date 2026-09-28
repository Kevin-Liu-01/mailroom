"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ConfirmButton } from "@/components/Confirm";

export function DisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    setBusy(true);
    await fetch("/api/disconnect", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <ConfirmButton
      className="btn-danger"
      armedClassName="btn-danger"
      icon={<LogOut size={15} aria-hidden="true" />}
      label="Disconnect and delete my data"
      confirmLabel="Delete everything"
      message="Revokes the Google token and deletes your data. Your Gmail labels and mail stay."
      onConfirm={disconnect}
      busy={busy}
      busyLabel="Removing…"
    />
  );
}
