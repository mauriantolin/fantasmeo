"use client";

import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function signInWithGoogle() {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/auth/callback` },
  });
  if (error) {
    toast.error("No se pudo iniciar sesión, probá de nuevo.");
  }
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 text-5xl" aria-hidden="true">
            👻
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Fantasmeo
          </CardTitle>
          <CardDescription>
            Trackeá tus postulaciones. Fantasmeá lo justo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            size="lg"
            onClick={signInWithGoogle}
          >
            Entrar con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
