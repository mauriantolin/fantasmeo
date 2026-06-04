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

// Internal wrappers keep stable keys and raw text separate from CVContent data.
interface Keyed<T> { key: string; value: T }
interface KeyedSkill { key: string; value: CVSkillGroup; itemsText: string }

function wrap<T>(items: T[]): Keyed<T>[] {
  return items.map((value) => ({ key: crypto.randomUUID(), value }));
}

function wrapSkills(items: CVSkillGroup[]): KeyedSkill[] {
  return items.map((value) => ({
    key: crypto.randomUUID(),
    value,
    itemsText: value.items.join(", "),
  }));
}

function unwrap<T>(items: Keyed<T>[]): T[] {
  return items.map((item) => item.value);
}

function unwrapSkills(items: KeyedSkill[]): CVSkillGroup[] {
  return items.map(({ itemsText, value }) => ({
    ...value,
    items: itemsText.split(",").map((s) => s.trim()).filter(Boolean),
  }));
}

export function CVEditor({ initialContent, onSave }: CVEditorProps) {
  const [contact, setContact] = useState(initialContent.contact);
  const [summary, setSummary] = useState(initialContent.summary ?? "");
  const [experience, setExperience] = useState<Keyed<CVExperience>[]>(() => wrap(initialContent.experience));
  const [education, setEducation] = useState<Keyed<CVEducation>[]>(() => wrap(initialContent.education));
  const [skills, setSkills] = useState<KeyedSkill[]>(() => wrapSkills(initialContent.skills));
  const [languages, setLanguages] = useState<Keyed<CVLanguage>[]>(() => wrap(initialContent.languages));
  const [certifications, setCertifications] = useState<Keyed<CVCertification>[]>(() => wrap(initialContent.certifications));
  const [isSaving, setIsSaving] = useState(false);

  // --- contact ---
  function updateContact(field: keyof CVContent["contact"], value: string) {
    setContact((prev) => ({ ...prev, [field]: value }));
  }

  // --- experience ---
  function updateExperience(index: number, field: keyof CVExperience, value: string | string[] | null) {
    setExperience((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: { ...updated[index].value, [field]: value } };
      return updated;
    });
  }

  function addExperience() {
    setExperience((prev) => [
      ...prev,
      { key: crypto.randomUUID(), value: { company: "", title: "", start: "", end: null, location: "", bullets: [] } },
    ]);
  }

  function removeExperience(index: number) {
    setExperience((prev) => prev.filter((_, i) => i !== index));
  }

  // --- education ---
  function updateEducation(index: number, field: keyof CVEducation, value: string) {
    setEducation((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: { ...updated[index].value, [field]: value } };
      return updated;
    });
  }

  function addEducation() {
    setEducation((prev) => [
      ...prev,
      { key: crypto.randomUUID(), value: { institution: "", degree: "", start: "", end: "" } },
    ]);
  }

  function removeEducation(index: number) {
    setEducation((prev) => prev.filter((_, i) => i !== index));
  }

  // --- skills ---
  function updateSkillCategory(index: number, value: string) {
    setSkills((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: { ...updated[index].value, category: value } };
      return updated;
    });
  }

  function updateSkillItemsText(index: number, text: string) {
    setSkills((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], itemsText: text };
      return updated;
    });
  }

  function addSkill() {
    setSkills((prev) => [
      ...prev,
      { key: crypto.randomUUID(), value: { category: "", items: [] }, itemsText: "" },
    ]);
  }

  function removeSkill(index: number) {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  }

  // --- languages ---
  function updateLanguage(index: number, field: keyof CVLanguage, value: string) {
    setLanguages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: { ...updated[index].value, [field]: value } };
      return updated;
    });
  }

  function addLanguage() {
    setLanguages((prev) => [
      ...prev,
      { key: crypto.randomUUID(), value: { name: "", level: "" } },
    ]);
  }

  function removeLanguage(index: number) {
    setLanguages((prev) => prev.filter((_, i) => i !== index));
  }

  // --- certifications ---
  function updateCertification(index: number, field: keyof CVCertification, value: string) {
    setCertifications((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: { ...updated[index].value, [field]: value } };
      return updated;
    });
  }

  function addCertification() {
    setCertifications((prev) => [
      ...prev,
      { key: crypto.randomUUID(), value: { name: "", issuer: "", year: "" } },
    ]);
  }

  function removeCertification(index: number) {
    setCertifications((prev) => prev.filter((_, i) => i !== index));
  }

  // --- save ---
  async function handleSave() {
    const content: CVContent = {
      contact,
      summary,
      experience: unwrap(experience),
      education: unwrap(education),
      skills: unwrapSkills(skills),
      languages: unwrap(languages),
      certifications: unwrap(certifications),
    };
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
                value={contact[field] ?? ""}
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
            id="cv-summary"
            aria-label="Resumen profesional"
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
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
          {experience.map(({ key, value: exp }, i) => (
            <div key={key} className="space-y-3">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`exp-${i}-company`}>Empresa</Label>
                  <Input id={`exp-${i}-company`} value={exp.company} onChange={(e) => updateExperience(i, "company", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`exp-${i}-title`}>Cargo</Label>
                  <Input id={`exp-${i}-title`} value={exp.title} onChange={(e) => updateExperience(i, "title", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`exp-${i}-start`}>Inicio (YYYY-MM)</Label>
                  <Input id={`exp-${i}-start`} value={exp.start} onChange={(e) => updateExperience(i, "start", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`exp-${i}-end`}>Fin (YYYY-MM o vacío si es actual)</Label>
                  <Input
                    id={`exp-${i}-end`}
                    value={exp.end ?? ""}
                    onChange={(e) => updateExperience(i, "end", e.target.value || null)}
                    placeholder="Presente"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`exp-${i}-location`}>Ubicación</Label>
                  <Input id={`exp-${i}-location`} value={exp.location ?? ""} onChange={(e) => updateExperience(i, "location", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`exp-${i}-bullets`}>Logros / responsabilidades (uno por línea)</Label>
                <Textarea
                  id={`exp-${i}-bullets`}
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
          {education.map(({ key, value: edu }, i) => (
            <div key={key} className="space-y-3">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`edu-${i}-institution`}>Institución</Label>
                  <Input id={`edu-${i}-institution`} value={edu.institution} onChange={(e) => updateEducation(i, "institution", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`edu-${i}-degree`}>Título / carrera</Label>
                  <Input id={`edu-${i}-degree`} value={edu.degree} onChange={(e) => updateEducation(i, "degree", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`edu-${i}-start`}>Inicio</Label>
                  <Input id={`edu-${i}-start`} value={edu.start ?? ""} onChange={(e) => updateEducation(i, "start", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`edu-${i}-end`}>Fin</Label>
                  <Input id={`edu-${i}-end`} value={edu.end ?? ""} onChange={(e) => updateEducation(i, "end", e.target.value)} />
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
          {skills.map(({ key, value: sg, itemsText }, i) => (
            <div key={key} className="space-y-2">
              {i > 0 && <Separator />}
              <div className="space-y-1">
                <Label htmlFor={`skill-${i}-category`}>Categoría</Label>
                <Input
                  id={`skill-${i}-category`}
                  value={sg.category}
                  onChange={(e) => updateSkillCategory(i, e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`skill-${i}-items`}>Habilidades (separadas por coma)</Label>
                <Input
                  id={`skill-${i}-items`}
                  value={itemsText}
                  onChange={(e) => updateSkillItemsText(i, e.target.value)}
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
          {languages.map(({ key, value: lang }, i) => (
            <div key={key} className="space-y-2">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`lang-${i}-name`}>Idioma</Label>
                  <Input id={`lang-${i}-name`} value={lang.name} onChange={(e) => updateLanguage(i, "name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`lang-${i}-level`}>Nivel</Label>
                  <Input id={`lang-${i}-level`} value={lang.level} onChange={(e) => updateLanguage(i, "level", e.target.value)} />
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
          {certifications.map(({ key, value: cert }, i) => (
            <div key={key} className="space-y-2">
              {i > 0 && <Separator />}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor={`cert-${i}-name`}>Nombre</Label>
                  <Input id={`cert-${i}-name`} value={cert.name} onChange={(e) => updateCertification(i, "name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cert-${i}-issuer`}>Emisor</Label>
                  <Input id={`cert-${i}-issuer`} value={cert.issuer ?? ""} onChange={(e) => updateCertification(i, "issuer", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cert-${i}-year`}>Año</Label>
                  <Input id={`cert-${i}-year`} value={cert.year ?? ""} onChange={(e) => updateCertification(i, "year", e.target.value)} />
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
