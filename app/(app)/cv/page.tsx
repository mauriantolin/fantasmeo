import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FilePdf, Trash, Upload } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadCVDialog } from "./upload-cv-dialog";
import { DeleteCVButton } from "./delete-cv-button";
import { ToggleCVActiveButton } from "./toggle-cv-active-button";

export default async function CVPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: cvs } = await supabase
    .from("base_cvs")
    .select("id, title, language, is_active, updated_at")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Mis CVs</h1>
        <UploadCVDialog />
      </div>

      {!cvs || cvs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FilePdf className="text-muted-foreground mb-4 h-12 w-12" />
          <p className="text-muted-foreground mb-4 text-sm">
            Todavía no subiste ningún CV.
          </p>
          <UploadCVDialog trigger={<Button>Subir mi primer CV</Button>} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cvs.map((cv) => (
            <Card key={cv.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="truncate">{cv.title}</span>
                  <Badge variant="secondary" className="shrink-0 uppercase">
                    {cv.language}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  Actualizado{" "}
                  {format(new Date(cv.updated_at), "d MMM yyyy", {
                    locale: es,
                  })}
                </p>
                <ToggleCVActiveButton id={cv.id} isActive={cv.is_active} />
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href={`/cv/${cv.id}`}>Editar</Link>
                </Button>
                <DeleteCVButton id={cv.id} />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
