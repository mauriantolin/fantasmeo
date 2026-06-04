"use client";

import { useState, useTransition } from "react";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS } from "@/lib/platforms";
import { updateApplication } from "@/app/(app)/applications/actions";

interface EditApplicationDialogProps {
  applicationId: string;
  companyName: string;
  positionTitle: string;
  platform: string;
  jobUrl: string | null;
}

export function EditApplicationDialog({
  applicationId,
  companyName,
  positionTitle,
  platform,
  jobUrl,
}: EditApplicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState(companyName);
  const [position, setPosition] = useState(positionTitle);
  const [plat, setPlat] = useState(platform);
  const [url, setUrl] = useState(jobUrl ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateApplication({
          applicationId,
          companyName: company.trim(),
          positionTitle: position.trim(),
          platform: plat,
          jobUrl: url.trim(),
        });
        toast.success("Postulación actualizada");
        setOpen(false);
      } catch {
        toast.error("No se pudo guardar, probá de nuevo");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PencilSimpleIcon className="size-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar postulación</DialogTitle>
          <DialogDescription>
            Actualizá los datos de la postulación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-company">Empresa</Label>
            <Input
              id="edit-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-position">Puesto</Label>
            <Input
              id="edit-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-platform">Plataforma</Label>
            <Select value={plat} onValueChange={setPlat} disabled={isPending}>
              <SelectTrigger id="edit-platform" className="w-full">
                <SelectValue placeholder="Seleccioná la plataforma" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-url">URL del aviso (opcional)</Label>
            <Input
              id="edit-url"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !company.trim() || !position.trim()}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
