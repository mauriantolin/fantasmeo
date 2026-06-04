import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmailReviewCard } from "@/components/email-review-card";
import { Timeline } from "@/components/timeline";
import { PageHeader } from "@/components/page-header";
import type { ApplicationEvent } from "@/lib/types";
import type { EmailReviewCardEmail } from "@/components/email-review-card";

// ─── Types for joined queries ─────────────────────────────────────────────────

interface MatchedEmailRow {
  id: string;
  from_address: string;
  subject: string | null;
  snippet: string | null;
  match_confidence: number | null;
  ai_classification: { classification: string; summary: string } | null;
  applications: {
    company_name: string;
    position_title: string;
  } | null;
}

interface EventRow {
  id: string;
  type: ApplicationEvent["type"];
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  applications: {
    company_name: string;
    position_title: string;
  } | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: activeCount },
    { count: waitingCount },
    { count: interviewCount },
    { count: ghostedCount },
    { count: totalCount },
    { data: pendingEmails },
    { data: recentEvents },
  ] = await Promise.all([
    // Postulaciones activas: applied | response_received | interview | offer
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .in("status", ["applied", "response_received", "interview", "offer"]),

    // Esperando respuesta
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "applied"),

    // Entrevistas
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "interview"),

    // Ghosteadas
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "ghosted"),

    // Total (to detect empty state)
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true }),

    // Emails pendientes de revisión con su postulación
    supabase
      .from("matched_emails")
      .select(
        "id, from_address, subject, snippet, match_confidence, ai_classification, applications(company_name, position_title)"
      )
      .eq("match_status", "pending_review")
      .order("created_at", { ascending: false })
      .returns<MatchedEmailRow[]>(),

    // Últimos 15 eventos con su postulación
    supabase
      .from("application_events")
      .select(
        "id, type, title, description, metadata, occurred_at, applications(company_name, position_title)"
      )
      .order("occurred_at", { ascending: false })
      .limit(15)
      .returns<EventRow[]>(),
  ]);

  const isEmpty = (totalCount ?? 0) === 0;
  const emails = pendingEmails ?? [];
  const events = recentEvents ?? [];

  // Company prefix goes into description so the original event title is preserved
  const timelineEventsMapped: ApplicationEvent[] = events.map((ev) => {
    const prefix = ev.applications
      ? `${ev.applications.company_name} · ${ev.applications.position_title}`
      : null;
    return {
      id: ev.id,
      type: ev.type,
      title: ev.title,
      description: prefix
        ? prefix + (ev.description ? ` — ${ev.description}` : "")
        : ev.description,
      metadata: ev.metadata,
      occurred_at: ev.occurred_at,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      {isEmpty ? (
        // ── Empty state ──────────────────────────────────────────────────────
        <Card>
          <CardHeader>
            <CardTitle>¡Empezá ahora!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Todavía no tenés postulaciones. Seguí estos pasos para comenzar:
            </p>
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  1
                </span>
                <span>
                  Subí tu CV{" "}
                  <Button variant="link" className="h-auto p-0 text-sm" asChild>
                    <Link href="/cv">Ir a CVs →</Link>
                  </Button>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  2
                </span>
                <span>
                  Cargá tu primera postulación{" "}
                  <Button variant="link" className="h-auto p-0 text-sm" asChild>
                    <Link href="/applications/new">Nueva postulación →</Link>
                  </Button>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  3
                </span>
                <span>
                  Conectá tu Gmail{" "}
                  <Button variant="link" className="h-auto p-0 text-sm" asChild>
                    <Link href="/settings">Ir a Configuración →</Link>
                  </Button>
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Stat cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Postulaciones activas
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-2xl font-bold tabular-nums">
                  {activeCount ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Esperando respuesta
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-2xl font-bold tabular-nums">
                  {waitingCount ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Entrevistas
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-2xl font-bold tabular-nums">
                  {interviewCount ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Ghosteadas 👻
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-2xl font-bold tabular-nums">
                  {ghostedCount ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Para revisar ────────────────────────────────────────────────── */}
          {emails.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Para revisar</h2>
              <div className="space-y-3">
                {emails.map((email) => {
                  const cardEmail: EmailReviewCardEmail = {
                    id: email.id,
                    from_address: email.from_address,
                    subject: email.subject,
                    snippet: email.snippet,
                    match_confidence: email.match_confidence,
                    ai_classification: email.ai_classification,
                  };
                  const label = email.applications
                    ? `${email.applications.company_name} — ${email.applications.position_title}`
                    : "Postulación desconocida";
                  return (
                    <EmailReviewCard
                      key={email.id}
                      email={cardEmail}
                      applicationLabel={label}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Actividad reciente ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
            <Card>
              <CardContent className="pt-4">
                <Timeline events={timelineEventsMapped} />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
