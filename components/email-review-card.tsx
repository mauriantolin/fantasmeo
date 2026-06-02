"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmEmailMatch } from "@/app/(app)/settings/actions";

const CLASSIFICATION_LABELS: Record<string, string> = {
  rejection: "Rechazo",
  interview: "Entrevista",
  offer: "Oferta",
  info_request: "Pedido de info",
  other: "Otro",
};

const CLASSIFICATION_VARIANTS: Record<
  string,
  "outline" | "default" | "secondary" | "destructive"
> = {
  rejection: "destructive",
  interview: "default",
  offer: "default",
  info_request: "secondary",
  other: "outline",
};

export interface EmailReviewCardEmail {
  id: string;
  from_address: string;
  subject: string | null;
  snippet: string | null;
  match_confidence: number | null;
  ai_classification: {
    classification: string;
    summary: string;
  } | null;
}

interface EmailReviewCardProps {
  email: EmailReviewCardEmail;
  applicationLabel: string;
}

export function EmailReviewCard({ email, applicationLabel }: EmailReviewCardProps) {
  const [isPending, startTransition] = useTransition();

  const classificationKey = email.ai_classification?.classification ?? "other";
  const classificationLabel = CLASSIFICATION_LABELS[classificationKey] ?? "Otro";
  const classificationVariant = CLASSIFICATION_VARIANTS[classificationKey] ?? "outline";
  const confidencePct =
    email.match_confidence != null
      ? Math.round(email.match_confidence * 100)
      : null;

  function handleConfirm(confirm: boolean) {
    startTransition(async () => {
      try {
        await confirmEmailMatch({ emailId: email.id, confirm });
        toast.success(confirm ? "Email confirmado" : "Email rechazado");
      } catch {
        toast.error("No se pudo procesar el email");
      }
    });
  }

  return (
    <Card className="text-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-snug">
            {email.subject ?? "(sin asunto)"}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={classificationVariant}>{classificationLabel}</Badge>
            {confidencePct != null && (
              <Badge variant="outline" className="tabular-nums">
                {confidencePct}%
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{email.from_address}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {email.snippet && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {email.snippet}
          </p>
        )}
        <p className="text-xs">
          <span className="text-muted-foreground">Postulación sugerida: </span>
          <span className="font-medium">{applicationLabel}</span>
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            disabled={isPending}
            onClick={() => handleConfirm(true)}
          >
            Sí, es de esta postulación
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleConfirm(false)}
          >
            No
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
