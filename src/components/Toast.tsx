import { useEffect } from "react";
import { useDict } from "../state/AppState";

export function Toast({
  message,
  kind = "error",
  onDismiss,
}: {
  message: string;
  kind?: "error" | "ok";
  onDismiss: () => void;
}) {
  const d = useDict();
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  return (
    <div className={`toast ${kind === "ok" ? "ok" : ""}`} role="status">
      <span>{message}</span>
      <button className="toast-close" type="button" onClick={onDismiss} aria-label={d.common.close} title={d.common.close}>×</button>
    </div>
  );
}
