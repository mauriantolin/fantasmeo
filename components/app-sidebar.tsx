"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SquaresFourIcon,
  BriefcaseIcon,
  FileTextIcon,
  GearIcon,
  SignOutIcon,
  ListIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", Icon: SquaresFourIcon },
  { label: "Postulaciones", href: "/applications", Icon: BriefcaseIcon },
  { label: "Mi CV", href: "/cv", Icon: FileTextIcon },
  { label: "Configuración", href: "/settings", Icon: GearIcon },
] as const;

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl" aria-hidden="true">
        👻
      </span>
      <span className="font-heading text-base font-semibold tracking-tight">
        Fantasmeo
      </span>
    </div>
  );
}

interface SidebarNavProps {
  userEmail: string;
  onNavigate?: () => void;
}

function SidebarNav({ userEmail, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("No se pudo cerrar sesión, probá de nuevo.");
      return;
    }
    router.push("/login");
  }

  const emailInitial = userEmail ? userEmail[0].toUpperCase() : "?";

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Wordmark />
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        aria-label="Navegación principal"
      >
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ label, href, Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Button
                  asChild
                  variant={isActive ? "secondary" : "ghost"}
                  size="lg"
                  className={cn(
                    "w-full justify-start gap-2.5 text-left",
                    isActive && "font-medium text-foreground"
                  )}
                >
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon className="size-5 shrink-0" weight={isActive ? "fill" : "regular"} />
                    {label}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{emailInitial}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-sm text-muted-foreground">
            {userEmail}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-2"
          >
            <SignOutIcon className="size-4" />
            Salir
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({ userEmail }: { userEmail: string }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex">
      <SidebarNav userEmail={userEmail} />
    </aside>
  );
}

export function MobileNav({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir menú de navegación"
            aria-expanded={open}
          >
            <ListIcon className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SidebarNav userEmail={userEmail} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Wordmark />
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
