"use client";

import { useTransition } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateStatus } from "@/app/(app)/applications/actions";
import type { ApplicationStatus } from "@/lib/types";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Borrador",
  applied: "Postulado",
  response_received: "Respuesta recibida",
  interview: "Entrevista",
  offer: "Oferta",
  rejected: "Rechazado",
  ghosted: "Ghosteado 👻",
  withdrawn: "Retirado",
};

const ALL_STATUSES: ApplicationStatus[] = [
  "draft",
  "applied",
  "response_received",
  "interview",
  "offer",
  "rejected",
  "ghosted",
  "withdrawn",
];

interface StatusDropdownProps {
  applicationId: string;
  currentStatus: ApplicationStatus;
}

export function StatusDropdown({
  applicationId,
  currentStatus,
}: StatusDropdownProps) {
  const [isPending, startTransition] = useTransition();

  function handleSelect(status: ApplicationStatus) {
    if (status === currentStatus) return;
    startTransition(async () => {
      try {
        await updateStatus({ applicationId, status });
        toast.success("Estado actualizado");
      } catch {
        toast.error("No se pudo actualizar el estado");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className="gap-1.5"
        >
          {STATUS_LABELS[currentStatus]}
          <CaretDownIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {ALL_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => handleSelect(s)}
            data-active={s === currentStatus ? true : undefined}
            className="data-[active]:font-medium"
          >
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
