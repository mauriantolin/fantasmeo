import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ProfileForm } from "./profile-form";
import { GmailDisconnectButton } from "./gmail-disconnect-button";
import { AddInviteForm } from "./add-invite-form";
import { GmailToast } from "./gmail-toast";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const gmailStatus =
    typeof params.gmail === "string" ? params.gmail : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, location, linkedin_url")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch Gmail connection
  const { data: gmailConnection } = await supabase
    .from("gmail_connections")
    .select("email_address, last_sync_at, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // Owner check for invites card
  const isOwner =
    !!user.email &&
    !!process.env.OWNER_EMAIL &&
    user.email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase();

  let invites: { id: string; email: string; used_at: string | null; created_at: string }[] = [];
  if (isOwner) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("invites")
      .select("id, email, used_at, created_at")
      .order("created_at", { ascending: false });
    invites = data ?? [];
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-lg font-semibold">Configuración</h1>

      <GmailToast status={gmailStatus} />

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              fullName: profile?.full_name ?? "",
              phone: profile?.phone ?? "",
              location: profile?.location ?? "",
              linkedinUrl: profile?.linkedin_url ?? "",
            }}
          />
        </CardContent>
      </Card>

      {/* Gmail */}
      <Card>
        <CardHeader>
          <CardTitle>Gmail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!gmailConnection ? (
            <>
              <p className="text-sm text-muted-foreground">
                Conectá tu Gmail para detectar respuestas automáticamente.
              </p>
              <Button asChild size="sm">
                <a href="/api/gmail/oauth/connect">Conectar Gmail</a>
              </Button>
            </>
          ) : (
            <>
              {gmailConnection.status === "error" && (
                <Alert variant="destructive">
                  <AlertTitle>La conexión expiró</AlertTitle>
                  <AlertDescription>
                    La conexión expiró, reconectá tu cuenta.{" "}
                    <a
                      href="/api/gmail/oauth/connect"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Reconectar
                    </a>
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{gmailConnection.email_address}</p>
                  <p className="text-xs text-muted-foreground">
                    {gmailConnection.last_sync_at
                      ? `Última sincronización: hace ${formatDistanceToNow(
                          new Date(gmailConnection.last_sync_at),
                          { locale: es }
                        )}`
                      : "Última sincronización: Nunca"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={gmailConnection.status === "active" ? "default" : "destructive"}
                  >
                    {gmailConnection.status === "active" ? "Activo" : "Error"}
                  </Badge>
                  <GmailDisconnectButton />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invitaciones — solo para el owner */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Invitaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddInviteForm />
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no enviaste invitaciones.
              </p>
            ) : (
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate">{invite.email}</span>
                    <Badge variant={invite.used_at ? "default" : "outline"}>
                      {invite.used_at ? "Usada" : "Pendiente"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
