"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { updateRentalAlertSettingsAction } from "@/features/rentals/actions";
import type { RentalAlertSettings as Settings } from "@/features/rentals/logic";

// Con cuánta anticipación avisa el módulo de alquileres (pantalla
// Contratos, filtros de la tabla y "Requiere acción"). Solo admin.
export function RentalAlertSettings({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [v, setV] = useState({ expiry: initial.expiryAlertDays, adjustment: initial.adjustmentAlertDays });
  const [busy, setBusy] = useState(false);
  const dirty = v.expiry !== initial.expiryAlertDays || v.adjustment !== initial.adjustmentAlertDays;
  const invalid = v.expiry < 15 || v.expiry > 365 || v.adjustment < 1 || v.adjustment > 90;

  const save = async () => {
    setBusy(true);
    try {
      const res = await updateRentalAlertSettingsAction({ expiry_alert_days: v.expiry, adjustment_alert_days: v.adjustment });
      if (res.success) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas de alquileres</CardTitle>
        <CardDescription>Con cuánta anticipación se avisa en Alquileres que un contrato vence o que se acerca un ajuste.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="expiry-days">Vencimiento de contrato (días antes)</Label>
            <Input id="expiry-days" type="number" min={15} max={365} value={v.expiry} onChange={(e) => setV({ ...v, expiry: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">De 15 a 365. Sirve para negociar la renovación con tiempo.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustment-days">Ajuste de canon (días antes)</Label>
            <Input id="adjustment-days" type="number" min={1} max={90} value={v.adjustment} onChange={(e) => setV({ ...v, adjustment: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">De 1 a 90. Para avisar al inquilino antes del aumento.</p>
          </div>
          <Button onClick={save} disabled={busy || !dirty || invalid} className="sm:mb-6">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
