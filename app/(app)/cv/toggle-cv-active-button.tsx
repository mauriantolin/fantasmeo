"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toggleCVActive } from "./actions";

export function ToggleCVActiveButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    startTransition(async () => {
      try {
        await toggleCVActive(id, checked);
      } catch (err) {
        toast.error("No se pudo actualizar");
        console.error(err);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={`cv-active-${id}`}
        checked={isActive}
        onCheckedChange={handleChange}
        disabled={isPending}
        aria-label="Activar CV"
      />
      <Label htmlFor={`cv-active-${id}`} className="text-xs cursor-pointer">
        Activo
      </Label>
    </div>
  );
}
