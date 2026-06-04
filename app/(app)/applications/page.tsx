import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ApplicationsTable } from "./applications-table";
import { PageHeader } from "@/components/page-header";
import type { ApplicationStatus } from "@/lib/types";

interface ApplicationRow {
  id: string;
  company_name: string;
  position_title: string;
  platform: string;
  status: ApplicationStatus;
  updated_at: string;
}

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: applications } = await supabase
    .from("applications")
    .select("id, company_name, position_title, platform, status, updated_at")
    .order("updated_at", { ascending: false })
    .returns<ApplicationRow[]>();

  const rows = applications ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Postulaciones"
        actions={
          <Button asChild>
            <Link href="/applications/new">Nueva postulación</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Todavía no cargaste ninguna postulación 👻
        </p>
      ) : (
        <ApplicationsTable applications={rows} />
      )}
    </div>
  );
}
