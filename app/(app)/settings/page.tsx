import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-lg font-semibold">Configuración</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ajustes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Todavía no hay nada acá.</p>
        </CardContent>
      </Card>
    </div>
  );
}
