import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  PlusIcon,
  PaperPlaneTiltIcon,
  FileTextIcon,
  EnvelopeSimpleIcon,
  TrayIcon,
  ArrowRightIcon,
  NoteIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { ApplicationEvent, EventType } from "@/lib/types";

const EVENT_ICON: Record<EventType, React.ComponentType<{ className?: string }>> = {
  created: PlusIcon,
  applied: PaperPlaneTiltIcon,
  cv_generated: FileTextIcon,
  cover_letter_generated: EnvelopeSimpleIcon,
  email_received: TrayIcon,
  status_changed: ArrowRightIcon,
  note_added: NoteIcon,
};

interface TimelineProps {
  events: ApplicationEvent[];
}

export function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aún no hay eventos registrados.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, index) => {
        const Icon = EVENT_ICON[event.type] ?? PlusIcon;
        const isLast = index === events.length - 1;

        return (
          <li key={event.id} className="flex gap-3">
            {/* vertical line + dot */}
            <div className="flex flex-col items-center">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-foreground/10">
                <Icon className="size-3.5 text-muted-foreground" />
              </span>
              {!isLast && (
                <span className="mt-1 w-px grow bg-border" aria-hidden />
              )}
            </div>

            {/* content */}
            <div className={`min-w-0 ${isLast ? "pb-0" : "pb-5"}`}>
              <p className="text-xs font-medium leading-7">{event.title}</p>
              {event.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event.description}
                </p>
              )}
              <time
                dateTime={event.occurred_at}
                className="mt-0.5 block text-[10px] text-muted-foreground/70"
              >
                {formatDistanceToNow(new Date(event.occurred_at), {
                  locale: es,
                  addSuffix: true,
                })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
