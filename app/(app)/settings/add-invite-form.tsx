"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addInvite } from "./actions";

export function AddInviteForm() {
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = inputRef.current?.value.trim();
    if (!email) return;

    startTransition(async () => {
      try {
        await addInvite({ email });
        if (inputRef.current) inputRef.current.value = "";
        toast.success(`Invitación enviada a ${email}`);
      } catch {
        toast.error("No se pudo enviar la invitación");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        ref={inputRef}
        type="email"
        aria-label="Correo electrónico para invitar"
        placeholder="email@ejemplo.com"
        disabled={isPending}
        className="flex-1"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        Invitar
      </Button>
    </form>
  );
}
