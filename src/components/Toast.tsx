import { useEffect } from "react";

export function Toast({
  message,
  kind = "error",
  onDismiss,
}: {
  message: string;
  kind?: "error" | "ok";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  return <div className={`toast ${kind === "ok" ? "ok" : ""}`}>{message}</div>;
}
