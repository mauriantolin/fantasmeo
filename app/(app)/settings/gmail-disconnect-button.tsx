"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectGmail } from "./actions";

export function GmailDisconnectButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await disconnectGmail();
        toast.success("Gmail desconectado");
      } catch {
        toast.error("No se pudo desconectar Gmail");
      }
    });
  }

  return (
    <Button variant="destructive" size="sm" disabled={isPending} onClick={handleClick}>
      Desconectar
    </Button>
  );
}
