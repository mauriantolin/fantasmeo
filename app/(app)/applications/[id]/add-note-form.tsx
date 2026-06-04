"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNote } from "@/app/(app)/applications/actions";

interface AddNoteFormProps {
  applicationId: string;
}

export function AddNoteForm({ applicationId }: AddNoteFormProps) {
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const note = textareaRef.current?.value.trim();
    if (!note) return;

    startTransition(async () => {
      try {
        await addNote({ applicationId, note });
        if (textareaRef.current) textareaRef.current.value = "";
        toast.success("Nota agregada");
      } catch {
        toast.error("No se pudo agregar la nota");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        ref={textareaRef}
        aria-label="Escribir una nota"
        placeholder="Escribí una nota..."
        rows={3}
        disabled={isPending}
        className="resize-none"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        Agregar nota
      </Button>
    </form>
  );
}
