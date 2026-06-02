import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-lg font-semibold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Todavía no hay nada acá.</p>
        </CardContent>
      </Card>
    </div>
  );
}
