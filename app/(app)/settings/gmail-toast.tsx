"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface GmailToastProps {
  status: string | undefined;
}

export function GmailToast({ status }: GmailToastProps) {
  useEffect(() => {
    if (status === "connected") {
      toast.success("Gmail conectado correctamente");
    } else if (status === "error") {
      toast.error("No se pudo conectar Gmail. Intentá de nuevo.");
    }
  // Only fire once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
