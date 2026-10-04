"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { applyAdjustmentAction } from "@/features/rentals/actions";
import {
  ADJUSTMENT_LABELS, daysBetween, formatDate, formatPeriod, indexPeriods, money, periodOf, type AdjustmentIndex,
} from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

export type AdjustmentData = {
  contractId: string; rentAmount: number; currency: string; adjustmentIndex: string; adjustmentMonths: number;
  basePeriod: string; indexLagMonths: number;
  nextAdjustmentDate: string | null; lastAdjustmentDate: string | null; active: boolean;
  preview: { amount: number; factor: number } | { error: string } | null;
  history: { id: string; effective_date: string; previous_amount: number; new_amount: number; index_code: string }[];
  tenant: { full_name: string; phone: string | null } | null; propertyTitle: string | null; today: string;
};

function whatsappLink(phone: string | null | undefined, message: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

export function AdjustmentCard({ a }: { a: AdjustmentData }) {
  const { busy, run } = useRunAction();
  const [manualAmount, setManualAmount] = useState(0);
  const isManual = a.adjustmentIndex === "MANUAL";
  const next = a.nextAdjustmentDate;
  const usesIndex = a.adjustmentIndex === "ICL" || a.adjustmentIndex === "IPC";
  const isCasaPropia = a.adjustmentIndex === "CASA_PROPIA";
  const compared = next && usesIndex ? indexPeriods(a.basePeriod, periodOf(next), a.indexLagMonths) : null;
  const previewAmount = isManual ? (manualAmount > 0 ? manualAmount : null)
    : a.preview && "amount" in a.preview ? a.preview.amount : null;
  const due = !!next && next <= a.today;
  const daysToNext = next ? daysBetween(a.today, next) : null;
  const wa = next && previewAmount != null && daysToNext != null && daysToNext >= 0 && daysToNext <= 30
    ? whatsappLink(a.tenant?.phone, `Hola ${a.tenant?.full_name ?? ""}, te informamos que desde el ${formatDate(next)} el alquiler de ${a.propertyTitle ?? "la propiedad"} será de ${money(previewAmount, a.currency)} según el ajuste pactado. Ante cualquier consulta, escribinos.`)
    : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-sm">
      <h3 className="text-base font-semibold">Canon y ajuste</h3>
      <p className="mt-1 text-muted-foreground">
        {ADJUSTMENT_LABELS[a.adjustmentIndex as AdjustmentIndex]}
        {a.adjustmentIndex !== "NINGUNO" && ` cada ${a.adjustmentMonths} meses`}
        {usesIndex && a.indexLagMonths > 0 && ` · rezago de ${a.indexLagMonths} ${a.indexLagMonths === 1 ? "mes" : "meses"}`}
      </p>

      {next ? (
        <div className="mt-4 space-y-3">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 tabular-nums">
            <dt className="text-muted-foreground">Canon actual</dt><dd className="text-right">{money(a.rentAmount, a.currency)}</dd>
            <dt className="text-muted-foreground">Próximo ajuste</dt><dd className="text-right">{formatDate(next)}</dd>
            {compared && <>
              <dt className="text-muted-foreground">Compara {a.adjustmentIndex}</dt>
              <dd className="text-right">{formatPeriod(compared.base)} a {formatPeriod(compared.target)}</dd>
            </>}
            {isCasaPropia && next && a.preview && "factor" in a.preview && <>
              <dt className="text-muted-foreground">Coeficiente de {formatPeriod(periodOf(next))}</dt>
              <dd className="text-right">{a.preview.factor.toLocaleString("es-AR", { maximumFractionDigits: 4 })}</dd>
            </>}
            {previewAmount != null && <>
              <dt className="text-muted-foreground">Nuevo canon previsto</dt>
              <dd className="text-right font-semibold">{money(previewAmount, a.currency)}</dd>
            </>}
          </dl>
          {a.preview && "error" in a.preview && !isManual && (
            <p className="text-xs text-warning">
              {a.preview.error} {isCasaPropia ? "Cargalo en Ajustes y el ajuste se aplica solo." : "Se aplica solo cuando se publique."}{" "}
              <Link href="/dashboard/ajustes" className="underline">{isCasaPropia ? "Cargar coeficiente" : "Ver índices"}</Link>
            </p>
          )}
          {isManual && a.active && (
            <div className="grid gap-1.5"><Label htmlFor="manual-rent">Nuevo canon</Label>
              <Input id="manual-rent" type="number" min="0.01" step="0.01" value={manualAmount || ""} onChange={(e) => setManualAmount(Number(e.target.value))} /></div>
          )}
          {a.active && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!!busy || !due || previewAmount == null} title={!due ? `Se aplica a partir del ${formatDate(next)}` : undefined}
                onClick={() => run("adjust", () => applyAdjustmentAction(a.contractId, isManual ? manualAmount : undefined))}>
                {busy === "adjust" ? <Loader2 className="size-4 animate-spin" /> : "Aplicar ajuste"}
              </Button>
              {wa && <Button asChild size="sm" variant="outline"><a href={wa} target="_blank" rel="noopener noreferrer"><FaWhatsapp className="size-4" aria-hidden /> Avisar al inquilino</a></Button>}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-muted-foreground">Sin ajustes pendientes en la vigencia del contrato.</p>
      )}

      {a.history.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Historial</p>
          <ul className="space-y-1 text-xs tabular-nums">
            {a.history.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{formatDate(item.effective_date)} · {item.index_code}</span>
                <span>{money(item.previous_amount, a.currency)} a {money(item.new_amount, a.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.lastAdjustmentDate && a.history.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Último ajuste: {formatDate(a.lastAdjustmentDate)}</p>
      )}
    </section>
  );
}
