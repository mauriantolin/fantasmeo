"use client";

import { useState, useTransition } from "react";
import { TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteApplication } from "@/app/(app)/applications/actions";

interface DeleteApplicationButtonProps {
  applicationId: string;
  companyName: string;
}

export function DeleteApplicationButton({
  applicationId,
  companyName,
}: DeleteApplicationButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        // Redirects to /applications on success.
        await deleteApplication({ applicationId });
      } catch {
        toast.error("No se pudo eliminar, probá de nuevo");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar postulación"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar postulación</DialogTitle>
          <DialogDescription>
            Vas a eliminar la postulación de <strong>{companyName}</strong>. Se
            borran también su historial, CVs y cover letters generados. Esta
            acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
