"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GhostSlider } from "@/components/ghost-slider";
import { CVPreview } from "@/components/cv-preview";
import { CVEditor } from "@/components/cv-editor";
import { getGhostBand, GHOST_BAND_LABELS } from "@/lib/ai/ghost-level";
import type { CVContent } from "@/lib/types";
import {
  generateTailoredCV,
  generateCoverLetterAction,
  updateGeneratedCV,
  updateCoverLetter,
} from "./actions";

interface BaseCV {
  id: string;
  title: string;
  language: string;
}

interface GeneratedCV {
  id: string;
  ghost_level: number;
  content: CVContent;
  created_at: string;
}

interface CoverLetter {
  id: string;
  content: string;
  created_at: string;
}

interface GenerationPanelProps {
  applicationId: string;
  baseCVs: BaseCV[];
  generatedCVs: GeneratedCV[];
  coverLetters: CoverLetter[];
}

export function GenerationPanel({
  applicationId,
  baseCVs,
  generatedCVs,
  coverLetters,
}: GenerationPanelProps) {
  return (
    <>
      <CVCard
        applicationId={applicationId}
        baseCVs={baseCVs}
        generatedCVs={generatedCVs}
      />
      <CoverLetterCard
        applicationId={applicationId}
        baseCVs={baseCVs}
        generatedCVs={generatedCVs}
        coverLetters={coverLetters}
      />
    </>
  );
}

// ----- CV Card -----

function CVCard({
  applicationId,
  baseCVs,
  generatedCVs,
}: {
  applicationId: string;
  baseCVs: BaseCV[];
  generatedCVs: GeneratedCV[];
}) {
  const [selectedBaseCv, setSelectedBaseCv] = useState<string>(
    baseCVs.length === 1 ? baseCVs[0].id : ""
  );
  const [ghostLevel, setGhostLevel] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [editingCvId, setEditingCvId] = useState<string | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      try {
        await generateTailoredCV({
          applicationId,
          baseCvId: selectedBaseCv,
          ghostLevel,
        });
        setShowNewVersion(false);
      } catch {
        toast.error("No se pudo generar, probá de nuevo");
      }
    });
  }

  async function handleSaveCV(cvId: string, content: CVContent) {
    try {
      await updateGeneratedCV({ id: cvId, content });
      setEditingCvId(null);
    } catch {
      toast.error("No se pudo guardar, probá de nuevo");
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>CV adaptado</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {generatedCVs.length === 0 ? (
          <div className="space-y-4">
            {baseCVs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Subí tu CV primero.{" "}
                <Link href="/cv" className="underline hover:text-foreground">
                  Ir a CVs
                </Link>
              </p>
            ) : (
              <>
                {baseCVs.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">CV base</p>
                    <Select value={selectedBaseCv} onValueChange={setSelectedBaseCv}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccioná un CV" />
                      </SelectTrigger>
                      <SelectContent>
                        {baseCVs.map((cv) => (
                          <SelectItem key={cv.id} value={cv.id}>
                            {cv.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <GhostSlider value={ghostLevel} onChange={setGhostLevel} />
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isPending || !selectedBaseCv}
                >
                  {isPending ? "Fantasmeando... 👻" : "Generar CV"}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs defaultValue={generatedCVs[0].id}>
              <TabsList className="flex-wrap h-auto gap-1">
                {generatedCVs.map((cv) => {
                  const band = getGhostBand(cv.ghost_level);
                  const label = GHOST_BAND_LABELS[band];
                  const date = format(new Date(cv.created_at), "d MMM", { locale: es });
                  return (
                    <TabsTrigger key={cv.id} value={cv.id} className="text-xs">
                      {label} · {date}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {generatedCVs.map((cv) => (
                <TabsContent key={cv.id} value={cv.id} className="mt-4 space-y-3">
                  {editingCvId === cv.id ? (
                    <CVEditor
                      initialContent={cv.content}
                      onSave={(content) => handleSaveCV(cv.id, content)}
                    />
                  ) : (
                    <CVPreview content={cv.content} />
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditingCvId(editingCvId === cv.id ? null : cv.id)
                      }
                    >
                      {editingCvId === cv.id ? "Cancelar" : "Editar"}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/api/pdf/cv/${cv.id}`} target="_blank">
                        Descargar PDF
                      </Link>
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Generate another version */}
            <div className="border-t pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowNewVersion((v) => !v)}
                className="text-xs"
              >
                {showNewVersion ? "▲ Ocultar" : "▼ Generar otra versión"}
              </Button>

              {showNewVersion && (
                <div className="mt-3 space-y-3">
                  {baseCVs.length > 1 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">CV base</p>
                      <Select
                        value={selectedBaseCv}
                        onValueChange={setSelectedBaseCv}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccioná un CV" />
                        </SelectTrigger>
                        <SelectContent>
                          {baseCVs.map((cv) => (
                            <SelectItem key={cv.id} value={cv.id}>
                              {cv.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <GhostSlider value={ghostLevel} onChange={setGhostLevel} />
                  <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isPending || !selectedBaseCv}
                  >
                    {isPending ? "Fantasmeando... 👻" : "Generar CV"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----- Cover Letter Card -----

function CoverLetterCard({
  applicationId,
  baseCVs,
  generatedCVs,
  coverLetters,
}: {
  applicationId: string;
  baseCVs: BaseCV[];
  generatedCVs: GeneratedCV[];
  coverLetters: CoverLetter[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeLetterIdx, setActiveLetterIdx] = useState(0);

  const activeLetter = coverLetters[activeLetterIdx] ?? null;

  function handleGenerate() {
    startTransition(async () => {
      try {
        const generatedCvId = generatedCVs[0]?.id;
        const baseCvId = baseCVs[0]?.id;
        await generateCoverLetterAction({
          applicationId,
          generatedCvId,
          baseCvId: generatedCvId ? undefined : baseCvId,
        });
        setActiveLetterIdx(0);
      } catch {
        toast.error("No se pudo generar, probá de nuevo");
      }
    });
  }

  function startEditing(text: string) {
    setEditText(text);
    setIsEditing(true);
  }

  async function handleSave(letterId: string) {
    setIsSaving(true);
    try {
      await updateCoverLetter({ id: letterId, content: editText });
      setIsEditing(false);
    } catch {
      toast.error("No se pudo guardar, probá de nuevo");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Cover letter</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {coverLetters.length === 0 ? (
          <Button size="sm" onClick={handleGenerate} disabled={isPending}>
            {isPending ? "Generando... 👻" : "Generar cover letter"}
          </Button>
        ) : (
          <div className="space-y-4">
            {coverLetters.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {coverLetters.map((cl, idx) => {
                  const date = format(new Date(cl.created_at), "d MMM", { locale: es });
                  return (
                    <Button
                      key={cl.id}
                      size="sm"
                      variant={idx === activeLetterIdx ? "default" : "outline"}
                      className="text-xs"
                      onClick={() => {
                        setActiveLetterIdx(idx);
                        setIsEditing(false);
                      }}
                    >
                      {date}
                    </Button>
                  );
                })}
              </div>
            )}

            {activeLetter && (
              <>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={12}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(activeLetter.id)}
                        disabled={isSaving}
                      >
                        {isSaving ? "Guardando…" : "Guardar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {activeLetter.content}
                  </p>
                )}

                {!isEditing && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(activeLetter.content)}
                    >
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/api/pdf/cover-letter/${activeLetter.id}`}
                        target="_blank"
                      >
                        Descargar PDF
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleGenerate}
                      disabled={isPending}
                    >
                      {isPending ? "Generando... 👻" : "Regenerar"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
