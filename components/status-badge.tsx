import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Borrador",
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  },
  applied: {
    label: "Postulado",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  },
  response_received: {
    label: "Respuesta recibida",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  interview: {
    label: "Entrevista",
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  },
  offer: {
    label: "Oferta",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  },
  rejected: {
    label: "Rechazado",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  },
  ghosted: {
    label: "Ghosteado 👻",
    className: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
  },
  withdrawn: {
    label: "Retirado",
    className: "border-border text-muted-foreground",
  },
};

interface StatusBadgeProps {
  status: ApplicationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
