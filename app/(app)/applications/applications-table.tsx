"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import type { ApplicationStatus } from "@/lib/types";

interface Application {
  id: string;
  company_name: string;
  position_title: string;
  platform: string;
  status: ApplicationStatus;
  updated_at: string;
}

interface ApplicationsTableProps {
  applications: Application[];
}

const ACTIVE_STATUSES: ApplicationStatus[] = [
  "applied",
  "response_received",
  "interview",
  "offer",
];

const FINISHED_STATUSES: ApplicationStatus[] = ["rejected", "ghosted", "withdrawn"];

function filterByTab(apps: Application[], tab: string): Application[] {
  if (tab === "active") return apps.filter((a) => ACTIVE_STATUSES.includes(a.status));
  if (tab === "finished") return apps.filter((a) => FINISHED_STATUSES.includes(a.status));
  return apps;
}

function filterBySearch(apps: Application[], query: string): Application[] {
  if (!query.trim()) return apps;
  const q = query.toLowerCase();
  return apps.filter(
    (a) =>
      a.company_name.toLowerCase().includes(q) ||
      a.position_title.toLowerCase().includes(q)
  );
}

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = filterBySearch(filterByTab(applications, tab), search);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por empresa o puesto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="finished">Terminadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay postulaciones que coincidan.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última actualización</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link
                        href={`/applications/${app.id}`}
                        className="font-medium hover:underline"
                      >
                        {app.company_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.position_title}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.platform}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(app.updated_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
