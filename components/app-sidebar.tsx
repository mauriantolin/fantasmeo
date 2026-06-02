"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  SquaresFourIcon,
  BriefcaseIcon,
  FileTextIcon,
  GearIcon,
  SignOutIcon,
} from "@phosphor-icons/react";

import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", Icon: SquaresFourIcon },
  { label: "Postulaciones", href: "/applications", Icon: BriefcaseIcon },
  { label: "Mi CV", href: "/cv", Icon: FileTextIcon },
  { label: "Configuración", href: "/settings", Icon: GearIcon },
] as const;

interface AppSidebarProps {
  userEmail: string;
}

export function AppSidebar({ userEmail }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const emailInitial = userEmail ? userEmail[0].toUpperCase() : "?";

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Wordmark */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="text-xl" aria-hidden="true">
          👻
        </span>
        <span className="font-heading text-sm font-semibold tracking-tight">
          Fantasmeo
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación principal">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <li key={href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2 text-left",
                    isActive && "font-medium"
                  )}
                  onClick={() => router.push(href)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{emailInitial}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {userEmail}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSignOut}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <SignOutIcon className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
