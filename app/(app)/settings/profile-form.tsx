"use client";

import { useTransition, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "./actions";

interface ProfileFormProps {
  defaultValues: {
    fullName: string;
    phone: string;
    location: string;
    linkedinUrl: string;
  };
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProfile({
          fullName: (data.get("fullName") as string) || undefined,
          phone: (data.get("phone") as string) || undefined,
          location: (data.get("location") as string) || undefined,
          linkedinUrl: (data.get("linkedinUrl") as string) || undefined,
        });
        toast.success("Perfil actualizado");
      } catch {
        toast.error("No se pudo actualizar el perfil");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaultValues.fullName}
          placeholder="Tu nombre"
          disabled={isPending}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="phone">Teléfono</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={defaultValues.phone}
          placeholder="+54 9 11 1234-5678"
          disabled={isPending}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="location">Ubicación</Label>
        <Input
          id="location"
          name="location"
          defaultValue={defaultValues.location}
          placeholder="Buenos Aires, Argentina"
          disabled={isPending}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
        <Input
          id="linkedinUrl"
          name="linkedinUrl"
          type="url"
          defaultValue={defaultValues.linkedinUrl}
          placeholder="https://linkedin.com/in/tu-perfil"
          disabled={isPending}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        Guardar cambios
      </Button>
    </form>
  );
}
