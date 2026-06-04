import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/types";

// Each status carries a label AND a shape cue (dot, or 👻 for ghosted) so state
// is never conveyed by color alone. Colors use semantic design-system tokens.
const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; className: string; icon?: string }
> = {
  draft: {
    label: "Borrador",
    className:
      "border-status-neutral-foreground/20 bg-status-neutral-surface text-status-neutral-foreground",
  },
  applied: {
    label: "Postulado",
    className:
      "border-status-blue-foreground/20 bg-status-blue-surface text-status-blue-foreground",
  },
  response_received: {
    label: "Respuesta recibida",
    className:
      "border-status-amber-foreground/20 bg-status-amber-surface text-status-amber-foreground",
  },
  interview: {
    label: "Entrevista",
    className:
      "border-status-violet-foreground/20 bg-status-violet-surface text-status-violet-foreground",
  },
  offer: {
    label: "Oferta",
    className:
      "border-status-green-foreground/20 bg-status-green-surface text-status-green-foreground",
  },
  rejected: {
    label: "Rechazado",
    className:
      "border-status-red-foreground/20 bg-status-red-surface text-status-red-foreground",
  },
  ghosted: {
    label: "Ghosteado",
    icon: "👻",
    className:
      "border-status-zinc-foreground/20 bg-status-zinc-surface text-status-zinc-foreground",
  },
  withdrawn: {
    label: "Retirado",
    className: "border-border bg-muted text-muted-foreground",
  },
};

interface StatusBadgeProps {
  status: ApplicationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.icon ? (
        <span aria-hidden="true">{config.icon}</span>
      ) : (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {config.label}
    </Badge>
  );
}
