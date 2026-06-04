"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { previewFromUrl, previewFromText, createApplication } from "../actions";
import { PLATFORMS } from "@/lib/platforms";
import type { JDSummary } from "@/lib/types";

type Step = "input" | "preview";

function inferPlatformFromUrl(rawUrl: string): string {
  try {
    const { hostname } = new URL(rawUrl);
    if (hostname.includes("linkedin.com")) return "LinkedIn";
    if (hostname.includes("indeed.com")) return "Indeed";
    if (hostname.includes("glassdoor.com")) return "Glassdoor";
  } catch {
    // invalid URL — fall through
  }
  return "Otra";
}

interface PreviewData {
  jdText: string;
  jdSummary: JDSummary;
}

export default function NewApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [isPending, startTransition] = useTransition();

  // Step 1 — input
  const [url, setUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [platform, setPlatform] = useState("");

  // Step 2 — preview/edit
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [markAsApplied, setMarkAsApplied] = useState(true);

  function handleReadUrl() {
    if (!url) return;
    startTransition(async () => {
      try {
        const result = await previewFromUrl({ url });
        if ("error" in result && result.error === "scrape_failed") {
          setShowManual(true);
          toast.error(
            "No pudimos leer el aviso (la página lo bloquea). Pegá el texto acá."
          );
          return;
        }
        if ("jdSummary" in result) {
          populatePreview(result as PreviewData);
        }
      } catch {
        toast.error("Error al leer el aviso. Intentá de nuevo.");
      }
    });
  }

  function handleAnalyzeManual() {
    if (!manualText || !platform) return;
    startTransition(async () => {
      try {
        const result = await previewFromText({
          jdText: manualText,
          url: url || undefined,
        });
        populatePreview(result as PreviewData);
      } catch {
        toast.error("Error al analizar el texto. Intentá de nuevo.");
      }
    });
  }

  function populatePreview(data: PreviewData) {
    setPreview(data);
    setCompanyName(data.jdSummary.company ?? "");
    setPositionTitle(data.jdSummary.position ?? "");
    setSeniority(data.jdSummary.seniority ?? "");
    // If platform not yet set (URL flow), infer from URL or fall back to "Otra"
    if (!platform) {
      setPlatform(url ? inferPlatformFromUrl(url) : "Otra");
    }
    setStep("preview");
  }

  function handleCreate() {
    if (!preview) return;
    startTransition(async () => {
      try {
        const { id } = await createApplication({
          companyName,
          positionTitle,
          platform,
          jobUrl: url || "",
          jdText: preview.jdText,
          jdSummary: {
            ...preview.jdSummary,
            company: companyName,
            position: positionTitle,
            seniority: seniority || undefined,
          },
          markAsApplied,
        });
        router.push(`/applications/${id}`);
      } catch {
        toast.error("Error al crear la postulación. Intentá de nuevo.");
      }
    });
  }

  if (step === "input") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Nueva postulación</h1>

        <div className="space-y-3">
          <Label htmlFor="url">URL del aviso</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              type="url"
              placeholder="https://www.linkedin.com/jobs/view/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
              className="flex-1"
            />
            <Button
              onClick={handleReadUrl}
              disabled={isPending || !url}
              size="sm"
            >
              {isPending ? "Leyendo..." : "Leer aviso"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setShowManual((v) => !v)}
          >
            {showManual ? "Ocultar" : "Pegar el texto a mano"}
          </button>

          {showManual && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="platform">Plataforma</Label>
                <Select value={platform} onValueChange={setPlatform} disabled={isPending}>
                  <SelectTrigger id="platform">
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
                <Label htmlFor="manual-text">Texto de la descripción</Label>
                <Textarea
                  id="manual-text"
                  placeholder="Pegá acá la descripción del puesto..."
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  disabled={isPending}
                  rows={8}
                />
              </div>

              <Button
                onClick={handleAnalyzeManual}
                disabled={isPending || !manualText || !platform}
                size="sm"
                className="w-full"
              >
                {isPending ? "Analizando..." : "Analizar"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setStep("input")}
          >
            ← Volver
          </button>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Revisá los datos</h1>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="position">Puesto</Label>
            <Input
              id="position"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seniority">Seniority</Label>
            <Input
              id="seniority"
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              placeholder="ej: senior, semi-senior..."
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="platform-preview">Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform} disabled={isPending}>
              <SelectTrigger id="platform-preview">
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

          {preview.jdSummary.required_skills.length > 0 && (
            <div className="space-y-1.5">
              <Label>Skills requeridas</Label>
              <div className="flex flex-wrap gap-1">
                {preview.jdSummary.required_skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {preview.jdSummary.keywords.length > 0 && (
            <div className="space-y-1.5">
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-1">
                {preview.jdSummary.keywords.map((kw) => (
                  <Badge key={kw} variant="outline">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {preview.jdSummary.summary && (
            <div className="space-y-1.5">
              <Label>Resumen del puesto</Label>
              <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {preview.jdSummary.summary}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              id="mark-applied"
              type="checkbox"
              checked={markAsApplied}
              onChange={(e) => setMarkAsApplied(e.target.checked)}
              className="size-4 rounded-sm border-border accent-primary"
              disabled={isPending}
            />
            <Label htmlFor="mark-applied" className="cursor-pointer">
              Ya me postulé
            </Label>
          </div>
        </div>

        <Button
          onClick={handleCreate}
          disabled={isPending || !companyName || !positionTitle || !platform}
          className="w-full"
        >
          {isPending ? "Creando postulación..." : "Crear postulación"}
        </Button>
      </div>
    );
  }

  return null;
}
