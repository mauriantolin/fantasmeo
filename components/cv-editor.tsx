"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash } from "@phosphor-icons/react";

import type { CVContent, CVExperience, CVEducation, CVSkillGroup, CVLanguage, CVCertification } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CVEditorProps {
  initialContent: CVContent;
  onSave: (content: CVContent) => Promise<void>;
}

export function CVEditor({ initialContent, onSave }: CVEditorProps) {
  const [content, setContent] = useState<CVContent>(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  // --- helpers ---
  function updateContact(field: keyof CVContent["contact"], value: string) {
    setContent((prev) => ({
      ...prev,
      contact: { ...prev.contact, [field]: value },
    }));
  }

  function updateExperience(index: number, field: keyof CVExperience, value: string | string[] | null) {
    setContent((prev) => {
      const updated = [...prev.experience];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, experience: updated };
    });
  }

  function addExperience() {
    setContent((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        { company: "", title: "", start: "", end: null, location: "", bullets: [] },
      ],
    }));
  }

  function removeExperience(index: number) {
    setContent((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }));
  }

  function updateEducation(index: number, field: keyof CVEducation, value: string) {
    setContent((prev) => {
      const updated = [...prev.education];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, education: updated };
    });
  }

  function addEducation() {
    setContent((prev) => ({
      ...prev,
      education: [...prev.education, { institution: "", degree: "", start: "", end: "" }],
    }));
  }

  function removeEducation(index: number) {
    setContent((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  }

  function updateSkill(index: number, field: keyof CVSkillGroup, value: string | string[]) {
    setContent((prev) => {
      const updated = [...prev.skills];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, skills: updated };
    });
  }

  function addSkill() {
    setContent((prev) => ({
      ...prev,
      skills: [...prev.skills, { category: "", items: [] }],
    }));
  }

  function removeSkill(index: number) {
    setContent((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  }

  function updateLanguage(index: number, field: keyof CVLanguage, value: string) {
    setContent((prev) => {
      const updated = [...prev.languages];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, languages: updated };
    });
  }

  function addLanguage() {
    setContent((prev) => ({
      ...prev,
      languages: [...prev.languages, { name: "", level: "" }],
    }));
  }

  function removeLanguage(index: number) {
    setContent((prev) => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index),
    }));
  }

  function updateCertification(index: number, field: keyof CVCertification, value: string) {
    setContent((prev) => {
      const updated = [...prev.certifications];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, certifications: updated };
    });
  }

  function addCertification() {
    setContent((prev) => ({
      ...prev,
      certifications: [...prev.certifications, { name: "", issuer: "", year: "" }],
    }));
  }

  function removeCertification(index: number) {
    setContent((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(content);
      toast.success("CV guardado");
    } catch {
      toast.error("Error al guardar el CV.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Contacto */}
      <Card>
        <CardHeader>
          <CardTitle>Contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(["name", "email", "phone", "location", "linkedin", "website"] as const).map((field) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`contact-${field}`} className="capitalize">
                {field === "name" ? "Nombre" :
                 field === "email" ? "Email" :
                 field === "phone" ? "Teléfono" :
                 field === "location" ? "Ubicación" :
                 field === "linkedin" ? "LinkedIn" : "Sitio web"}
              </Label>
              <Input
                id={`contact-${field}`}
                value={content.contact[field] ?? ""}
                onChange={(e) => updateContact(field, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resumen */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={content.summary ?? ""}
            onChange={(e) => setContent((prev) => ({ ...prev, summary: e.target.value }))}
            placeholder="Breve presentación profesional…"
          />
        </CardContent>
      </Card>

      {/* Experiencia */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Experiencia</CardTitle>
          <Button variant="outline" size="sm" onClick={addExperience}>
            <Plus className="mr-1 h-4 w-4" /> Agregar experiencia
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {content.experience.map((exp, i) => (
            <div key={i} className="space-y-3">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Empresa</Label>
                  <Input value={exp.company} onChange={(e) => updateExperience(i, "company", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cargo</Label>
                  <Input value={exp.title} onChange={(e) => updateExperience(i, "title", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Inicio (YYYY-MM)</Label>
                  <Input value={exp.start} onChange={(e) => updateExperience(i, "start", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Fin (YYYY-MM o vacío si es actual)</Label>
                  <Input
                    value={exp.end ?? ""}
                    onChange={(e) => updateExperience(i, "end", e.target.value || null)}
                    placeholder="Presente"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Ubicación</Label>
                  <Input value={exp.location ?? ""} onChange={(e) => updateExperience(i, "location", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Logros / responsabilidades (uno por línea)</Label>
                <Textarea
                  rows={4}
                  value={exp.bullets.join("\n")}
                  onChange={(e) =>
                    updateExperience(i, "bullets", e.target.value.split("\n"))
                  }
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeExperience(i)}>
                <Trash className="mr-1 h-4 w-4" /> Eliminar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Educación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Educación</CardTitle>
          <Button variant="outline" size="sm" onClick={addEducation}>
            <Plus className="mr-1 h-4 w-4" /> Agregar educación
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {content.education.map((edu, i) => (
            <div key={i} className="space-y-3">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Institución</Label>
                  <Input value={edu.institution} onChange={(e) => updateEducation(i, "institution", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Título / carrera</Label>
                  <Input value={edu.degree} onChange={(e) => updateEducation(i, "degree", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Inicio</Label>
                  <Input value={edu.start ?? ""} onChange={(e) => updateEducation(i, "start", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input value={edu.end ?? ""} onChange={(e) => updateEducation(i, "end", e.target.value)} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeEducation(i)}>
                <Trash className="mr-1 h-4 w-4" /> Eliminar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Habilidades</CardTitle>
          <Button variant="outline" size="sm" onClick={addSkill}>
            <Plus className="mr-1 h-4 w-4" /> Agregar categoría
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {content.skills.map((sg, i) => (
            <div key={i} className="space-y-2">
              {i > 0 && <Separator />}
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Input
                  value={sg.category}
                  onChange={(e) => updateSkill(i, "category", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Habilidades (separadas por coma)</Label>
                <Input
                  value={sg.items.join(", ")}
                  onChange={(e) =>
                    updateSkill(i, "items", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                  }
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeSkill(i)}>
                <Trash className="mr-1 h-4 w-4" /> Eliminar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Idiomas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Idiomas</CardTitle>
          <Button variant="outline" size="sm" onClick={addLanguage}>
            <Plus className="mr-1 h-4 w-4" /> Agregar idioma
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {content.languages.map((lang, i) => (
            <div key={i} className="space-y-2">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Idioma</Label>
                  <Input value={lang.name} onChange={(e) => updateLanguage(i, "name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Nivel</Label>
                  <Input value={lang.level} onChange={(e) => updateLanguage(i, "level", e.target.value)} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeLanguage(i)}>
                <Trash className="mr-1 h-4 w-4" /> Eliminar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Certificaciones */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Certificaciones</CardTitle>
          <Button variant="outline" size="sm" onClick={addCertification}>
            <Plus className="mr-1 h-4 w-4" /> Agregar certificación
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {content.certifications.map((cert, i) => (
            <div key={i} className="space-y-2">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input value={cert.name} onChange={(e) => updateCertification(i, "name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Emisor</Label>
                  <Input value={cert.issuer ?? ""} onChange={(e) => updateCertification(i, "issuer", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Año</Label>
                  <Input value={cert.year ?? ""} onChange={(e) => updateCertification(i, "year", e.target.value)} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeCertification(i)}>
                <Trash className="mr-1 h-4 w-4" /> Eliminar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
