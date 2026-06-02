"use client";

import { useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteCV } from "./actions";

export function DeleteCVButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await deleteCV(id);
        toast.success("CV eliminado.");
      } catch (err) {
        toast.error("No se pudo eliminar el CV.");
        console.error(err);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Eliminar CV"
    >
      <Trash className="h-4 w-4" />
    </Button>
  );
}
