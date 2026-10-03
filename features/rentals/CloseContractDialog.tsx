"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { closeContractAction } from "@/features/rentals/lifecycleActions";
import { formatDate } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

// Finalizar (fin pactado) o rescindir (salida anticipada + penalidad). El
// RPC anula las cuotas posteriores sin cobrar y libera la propiedad.
export function CloseContractDialog({
  contractId, startDate, endDate, today, currency,
}: { contractId: string; startDate: string; endDate: string; today: string; currency: string }) {
  const { busy, run } = useRunAction();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"FINALIZADO" | "RESCINDIDO">(today >= endDate ? "FINALIZADO" : "RESCINDIDO");
  const [exitDate, setExitDate] = useState(today < endDate ? today : endDate);
  const [penalty, setPenalty] = useState(0);

  const rescinding = status === "RESCINDIDO";
  const validDate = exitDate > startDate && exitDate <= endDate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Cerrar contrato</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar contrato</DialogTitle>
          <DialogDescription>
            Se anulan las cuotas posteriores a la salida que no tengan cobros y la propiedad vuelve a estar disponible.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Motivo</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as "FINALIZADO" | "RESCINDIDO")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FINALIZADO">Finalizado (fin pactado {formatDate(endDate)})</SelectItem>
                <SelectItem value="RESCINDIDO">Rescisión anticipada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rescinding && <>
            <div className="grid gap-1.5">
              <Label>Fecha de salida</Label>
              <Input type="date" min={startDate} max={endDate} value={exitDate} onChange={(event) => setExitDate(event.target.value)} />
              {!validDate && <p className="text-xs text-danger">Tiene que estar dentro de la vigencia del contrato.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Penalidad ({currency})</Label>
              <Input type="number" min={0} step="0.01" value={penalty || ""} onChange={(event) => setPenalty(Number(event.target.value))} />
              <p className="text-xs text-muted-foreground">Se carga como cargo en la cuenta corriente del inquilino. Dejalo vacío si no corresponde.</p>
            </div>
          </>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant={rescinding ? "destructive" : "default"}
            disabled={!!busy || (rescinding && (!validDate || penalty < 0))}
            onClick={async () => {
              const ok = await run("close", () => closeContractAction({
                contract_id: contractId,
                status,
                end_date: rescinding ? exitDate : undefined,
                penalty: rescinding ? penalty : 0,
              }));
              if (ok) setOpen(false);
            }}
          >
            {busy === "close" ? <Loader2 className="size-4 animate-spin" /> : rescinding ? "Rescindir" : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
