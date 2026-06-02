import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ApplicationRow, ApplicationEvent, CVContent } from "@/lib/types";
import { StatusDropdown } from "./status-dropdown";
import { AddNoteForm } from "./add-note-form";
import { GenerationPanel } from "./generation-panel";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: application },
    { data: events },
    { data: baseCVs },
    { data: generatedCVs },
    { data: coverLetters },
  ] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, company_name, position_title, platform, job_url, jd_text, jd_summary, status, applied_at, notes, created_at, updated_at"
      )
      .eq("id", id)
      .single<ApplicationRow>(),
    supabase
      .from("application_events")
      .select("id, type, title, description, metadata, occurred_at")
      .eq("application_id", id)
      .order("occurred_at", { ascending: false })
      .returns<ApplicationEvent[]>(),
    supabase
      .from("base_cvs")
      .select("id, title, language")
      .eq("is_active", true),
    supabase
      .from("generated_cvs")
      .select("id, ghost_level, content, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letters")
      .select("id, content, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!application) notFound();

  const timeline = events ?? [];
  const jd = application.jd_summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-lg font-semibold">
              {application.company_name}
            </h1>
            <StatusBadge status={application.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {application.position_title}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusDropdown
            applicationId={application.id}
            currentStatus={application.status}
          />
          {application.job_url && (
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={application.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5"
              >
                Ver oferta
                <ArrowSquareOutIcon className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: timeline + add note */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Historial</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Timeline events={timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Agregar nota</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <AddNoteForm applicationId={application.id} />
            </CardContent>
          </Card>
        </div>

        {/* Right: JD summary + placeholder cards */}
        <div className="space-y-4">
          {jd && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Descripción del puesto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {jd.seniority && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Seniority
                    </p>
                    <p className="text-xs">{jd.seniority}</p>
                  </div>
                )}

                {jd.required_skills.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Skills requeridos
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {jd.required_skills.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {jd.nice_to_have.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Deseables
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {jd.nice_to_have.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {jd.keywords.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Keywords
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {jd.keywords.join(", ")}
                    </p>
                  </div>
                )}

                {jd.summary && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Resumen
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {jd.summary}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <GenerationPanel
            applicationId={application.id}
            baseCVs={baseCVs ?? []}
            generatedCVs={(generatedCVs ?? []) as { id: string; ghost_level: number; content: CVContent; created_at: string }[]}
            coverLetters={coverLetters ?? []}
          />
        </div>
      </div>
    </div>
  );
}
