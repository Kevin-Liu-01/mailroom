"use client";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Two-click confirmation in place of window.confirm. The first click arms the button and shows the
 * consequence in one line; the second click confirms. It disarms on Cancel or after eight seconds.
 */
export function ConfirmButton({
  label, confirmLabel = "Confirm", message, onConfirm, className = "btn", armedClassName = "btn-primary", disabled = false, busy = false, busyLabel, icon,
}: {
  label: ReactNode;
  confirmLabel?: ReactNode;
  message?: ReactNode;
  onConfirm: () => void;
  className?: string;
  armedClassName?: string;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: ReactNode;
  icon?: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 8000);
    return () => clearTimeout(t);
  }, [armed]);
  if (busy) return <button type="button" className={className} disabled>{icon}{busyLabel ?? label}</button>;
  if (!armed) return <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>{icon}{label}</button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label="Confirm">
      {message ? <span className="text-[12.5px] text-muted">{message}</span> : null}
      <button type="button" className={armedClassName} onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="btn" onClick={() => setArmed(false)}>Cancel</button>
    </span>
  );
}
