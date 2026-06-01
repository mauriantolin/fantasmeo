import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Reason = "not_invited" | "no_code" | "exchange_failed" | string | undefined;

function getErrorContent(reason: Reason) {
  if (reason === "not_invited") {
    return {
      title: "No estás invitado todavía",
      description: "Pedile una invitación a Mauricio.",
    };
  }
  return {
    title: "Error de autenticación",
    description: "Algo salió mal al intentar iniciar sesión. Intentalo de nuevo.",
  };
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const { title, description } = getErrorContent(reason);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 text-5xl" aria-hidden="true">
            👻
          </div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Volver a intentar</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
