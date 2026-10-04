"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Page, PageHeader } from "@/shared/components/PageShell";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE, daysBetween, formatDate, money, type ContractTab, type OwnerShare,
} from "@/features/rentals/logic";
import { CloseContractDialog } from "@/features/rentals/CloseContractDialog";
import { EditContractDialog, type ContactData } from "@/features/rentals/EditContractDialog";
import { PartiesCard, type Party } from "@/features/rentals/PartiesCard";
import { DepositCard, type DepositData } from "@/features/rentals/DepositCard";
import { MaintenanceCard, type MaintenanceItem } from "@/features/rentals/MaintenanceCard";
import { DocumentsCard, type RentalDocument } from "@/features/rentals/DocumentsCard";
import { LedgerTab, collected, type LedgerCharge } from "@/features/rentals/LedgerTab";
import { SettlementsTab, type SettlementRow } from "@/features/rentals/SettlementsTab";
import { AdjustmentCard } from "@/features/rentals/AdjustmentCard";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";
import { RENTAL_TEMPLATES, type NoticeKind } from "@/features/rentals/noticeTemplates";

export type ContractDetailData = {
  id: string; status: string; start_date: string; end_date: string; rent_amount: number; currency: string;
  adjustment_index: string; adjustment_months: number; adjustment_pct: number | null; index_lag_months: number;
  base_period: string; next_adjustment_date: string | null; last_adjustment_date: string | null;
  commission_pct: number; late_fee_pct_daily: number; late_fee_fixed: number; payment_due_day: number;
  late_fee_mode: "AUTO" | "MANUAL"; late_fee_grace_days: number;
  guarantee_type: string; guarantee_detail: string | null; notes: string | null;
  renewed_from_id: string | null;
  property: { id: string; title: string } | null;
  owner: ContactData | null;
  tenant: ContactData | null;
  charges: LedgerCharge[];
  settlements: SettlementRow[];
  adjustments: { id: string; effective_date: string; previous_amount: number; new_amount: number; index_code: string }[];
  adjustmentPreview: { amount: number; factor: number } | { error: string } | null;
  parties: Party[];
  deposit: DepositData;
  maintenance: MaintenanceItem[];
  documents: RentalDocument[];
  contacts: { id: string; label: string; kind: string }[];
  notices: { id: string; kind: NoticeKind; status: string; detail: string | null; created_at: string; contact: { full_name: string } | null }[];
  today: string;
};

const NOTICE_STATUS: Record<string, { label: string; tone: "success" | "danger" | "neutral" }> = {
  ENVIADO: { label: "Enviado", tone: "success" },
  FALLIDO: { label: "Falló", tone: "danger" },
  OMITIDO: { label: "Sin teléfono", tone: "neutral" },
};

const GUARANTEE_LABELS: Record<string, string> = { NINGUNA: "Sin garantía", GARANTE: "Garante", CAUCION: "Seguro de caución" };

function whatsappLink(phone: string | null | undefined, message: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

export function ContractDetail({ c, initialTab }: { c: ContractDetailData; initialTab: ContractTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<ContractTab>(initialTab);
  const active = c.status === "ACTIVO";

  const changeTab = (value: string) => {
    setTab(value as ContractTab);
    router.replace(value === "resumen" ? pathname : `${pathname}?tab=${value}`, { scroll: false });
  };

  const overdue = c.charges.filter((charge) => charge.due_date < c.today && charge.amount - collected(charge) > 0.005);
  const overdueTotal = overdue.reduce((sum, charge) => sum + charge.amount - collected(charge), 0);
  const worstDelay = overdue.length ? Math.max(...overdue.map((charge) => daysBetween(charge.due_date, c.today))) : 0;
  const daysLeft = daysBetween(c.today, c.end_date);
  const openMaintenance = c.maintenance.filter((item) => item.status === "ABIERTO" || item.status === "EN_CURSO").length;
  const unpaidSettlements = c.settlements.filter((item) => !item.paid_to_owner_at).length;
  const settledPeriods = c.settlements.map((item) => item.period);
  // Titulares para el reparto: el principal se queda con el resto hasta 100 %.
  const coOwners = c.parties.filter((p) => p.role === "CO_PROPIETARIO");
  const owners: OwnerShare[] = [
    { name: c.owner?.full_name ?? "Propietario", pct: 100 - coOwners.reduce((sum, p) => sum + (p.share_pct ?? 0), 0), isPrimary: true },
    ...coOwners.map((p) => ({ name: p.contact.full_name, pct: p.share_pct ?? 0, isPrimary: false })),
  ];
  const overdueWa = overdue.length ? whatsappLink(c.tenant?.phone,
    `Hola ${c.tenant?.full_name ?? ""}, registramos un saldo pendiente de ${money(overdueTotal, c.currency)} correspondiente a ${c.property?.title ?? "tu alquiler"}. Por favor, contactanos para coordinar el pago.`) : null;

  return (
    <Page>
      <PageHeader
        backHref="/dashboard/alquileres"
        title={c.property ? <Link href={`/dashboard/propiedades/${c.property.id}`} className="hover:underline">{c.property.title}</Link> : "Contrato"}
        aside={<StatusBadge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"}>{CONTRACT_STATUS_LABELS[c.status] ?? c.status}</StatusBadge>}
        description={`${c.tenant?.full_name ?? "Sin inquilino"} · ${formatDate(c.start_date)} al ${formatDate(c.end_date)}`}
        actions={<div className="flex flex-wrap gap-2">
          <EditContractDialog
            contractId={c.id}
            owners={c.contacts.filter((o) => o.kind === "owner")}
            tenants={c.contacts.filter((o) => o.kind === "tenant")}
            initial={{
              owner_id: c.owner?.id ?? "", tenant_id: c.tenant?.id ?? "", commission_pct: c.commission_pct,
              late_fee_pct_daily: c.late_fee_pct_daily, late_fee_fixed: c.late_fee_fixed,
              late_fee_mode: c.late_fee_mode, late_fee_grace_days: c.late_fee_grace_days,
              guarantee_type: c.guarantee_type as "NINGUNA" | "GARANTE" | "CAUCION",
              guarantee_detail: c.guarantee_detail ?? "", notes: c.notes ?? "",
            }}
          />
          <Button asChild variant="outline"><Link href={`/dashboard/alquileres/nuevo?renovar=${c.id}`}>Renovar</Link></Button>
          {active && <CloseContractDialog contractId={c.id} startDate={c.start_date} endDate={c.end_date} today={c.today} currency={c.currency} rentAmount={c.rent_amount} />}
        </div>}
      />

      <StatStrip>
        <Stat label="Canon" value={money(c.rent_amount, c.currency)} detail={`Vence el día ${c.payment_due_day} de cada mes`} />
        <Stat
          label="Saldo vencido"
          value={overdue.length ? money(overdueTotal, c.currency) : "Al día"}
          tone={overdue.length ? "danger" : undefined}
          detail={overdue.length
            ? <span className="inline-flex items-center gap-2">{overdue.length} {overdue.length === 1 ? "cargo" : "cargos"}, hasta {worstDelay} días{overdueWa && <a href={overdueWa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"><FaWhatsapp className="size-3" aria-hidden /> Reclamar</a>}</span>
            : "Sin deuda"}
        />
        <Stat
          label="Próximo ajuste"
          value={c.next_adjustment_date ? formatDate(c.next_adjustment_date) : "Sin ajustes"}
          tone={c.next_adjustment_date && c.next_adjustment_date <= c.today ? "warning" : undefined}
          detail={!c.next_adjustment_date ? undefined
            : c.adjustmentPreview && "amount" in c.adjustmentPreview ? `Nuevo canon ${money(c.adjustmentPreview.amount, c.currency)}`
            : c.adjustment_index === "MANUAL" ? "Requiere cargar el monto"
            : `Falta el índice ${c.adjustment_index}`}
        />
        <Stat
          label={active ? "Vencimiento" : "Finalizó"}
          value={formatDate(c.end_date)}
          tone={active && daysLeft <= 60 ? "warning" : undefined}
          detail={active ? (daysLeft >= 0 ? `Faltan ${daysLeft} días` : `Vencido hace ${-daysLeft} días`) : CONTRACT_STATUS_LABELS[c.status]}
        />
      </StatStrip>

      <Tabs value={tab} onValueChange={changeTab} className="gap-4">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="cuenta">Cuenta corriente{overdue.length > 0 && <span className="rounded-full bg-danger/15 px-1.5 text-xs font-semibold tabular-nums text-danger">{overdue.length}</span>}</TabsTrigger>
            <TabsTrigger value="liquidaciones">Liquidaciones{unpaidSettlements > 0 && <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular-nums">{unpaidSettlements}</span>}</TabsTrigger>
            <TabsTrigger value="mantenimiento">Mantenimiento{openMaintenance > 0 && <span className="rounded-full bg-warning/15 px-1.5 text-xs font-semibold tabular-nums text-warning">{openMaintenance}</span>}</TabsTrigger>
            <TabsTrigger value="documentos">Documentos{c.documents.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{c.documents.length}</span>}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <AdjustmentCard a={{
                contractId: c.id, rentAmount: c.rent_amount, currency: c.currency, adjustmentIndex: c.adjustment_index,
                adjustmentMonths: c.adjustment_months, nextAdjustmentDate: c.next_adjustment_date,
                basePeriod: c.base_period, indexLagMonths: c.index_lag_months,
                lastAdjustmentDate: c.last_adjustment_date, active, preview: c.adjustmentPreview, history: c.adjustments,
                tenant: c.tenant, propertyTitle: c.property?.title ?? null, today: c.today,
              }} />
              <PartiesCard contractId={c.id} owner={c.owner} tenant={c.tenant} parties={c.parties} contacts={c.contacts} editable={active} />
            </div>
            <div className="space-y-6">
              <section className="rounded-lg border border-border bg-card p-4 text-sm">
                <h3 className="text-base font-semibold">Condiciones</h3>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">Garantía</dt>
                  <dd className="text-right">{GUARANTEE_LABELS[c.guarantee_type] ?? c.guarantee_type}{c.guarantee_detail ? `: ${c.guarantee_detail}` : ""}</dd>
                  <dt className="text-muted-foreground">Administración</dt>
                  <dd className="text-right">{c.commission_pct} % del alquiler cobrado</dd>
                  <dt className="text-muted-foreground">Punitorio</dt>
                  <dd className="text-right">
                    {c.late_fee_pct_daily} % diario{c.late_fee_fixed > 0 ? ` + ${money(c.late_fee_fixed, c.currency)}` : ""}
                    <span className="block text-xs text-muted-foreground">
                      {c.late_fee_mode === "AUTO" ? "Se calcula solo" : "Se carga a mano"}
                      {c.late_fee_grace_days > 0 ? ` · ${c.late_fee_grace_days} días de gracia` : ""}
                    </span>
                  </dd>
                  {c.renewed_from_id && <>
                    <dt className="text-muted-foreground">Renovación de</dt>
                    <dd className="text-right"><Link href={`/dashboard/alquileres/${c.renewed_from_id}`} className="underline-offset-4 hover:underline">Contrato anterior</Link></dd>
                  </>}
                </dl>
                {c.notes && <p className="mt-3 whitespace-pre-line border-t border-border pt-3 text-muted-foreground">{c.notes}</p>}
              </section>
              <DepositCard contractId={c.id} currency={c.currency} deposit={c.deposit} today={c.today} />
              {c.notices.length > 0 && (
                <section className="rounded-lg border border-border bg-card p-4 text-sm">
                  <h3 className="text-base font-semibold">Avisos por WhatsApp</h3>
                  <ul className="mt-3 space-y-2">
                    {c.notices.map((notice) => {
                      const status = NOTICE_STATUS[notice.status] ?? { label: notice.status, tone: "neutral" as const };
                      return (
                        <li key={notice.id} className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate">{RENTAL_TEMPLATES[notice.kind]?.label ?? notice.kind} · {notice.contact?.full_name ?? "Contacto"}</span>
                            <span className="block text-xs text-muted-foreground" title={notice.status === "FALLIDO" ? notice.detail ?? undefined : undefined}>
                              {new Date(notice.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                              {notice.status === "FALLIDO" && notice.detail ? ` · ${notice.detail}` : ""}
                            </span>
                          </span>
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cuenta">
          <LedgerTab
            contractId={c.id} charges={c.charges} settledPeriods={settledPeriods} today={c.today}
            lateFeePctDaily={c.late_fee_pct_daily} lateFeeFixed={c.late_fee_fixed} currency={c.currency} active={active}
            lateFeeMode={c.late_fee_mode} lateFeeGraceDays={c.late_fee_grace_days}
          />
        </TabsContent>

        <TabsContent value="liquidaciones">
          <SettlementsTab
            contractId={c.id} charges={c.charges} settlements={c.settlements} commissionPct={c.commission_pct}
            currency={c.currency} today={c.today} owners={owners}
            ownerMaintenance={c.maintenance
              .filter((m) => m.payer === "PROPIETARIO" && m.status !== "CANCELADO" && (m.cost ?? 0) > 0 && !m.settlement_id)
              .map((m) => ({ id: m.id, title: m.title, cost: m.cost!, resolved: m.status === "RESUELTO" }))}
          />
        </TabsContent>

        <TabsContent value="mantenimiento">
          <MaintenanceCard contractId={c.id} currency={c.currency} items={c.maintenance} today={c.today} />
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentsCard contractId={c.id} documents={c.documents} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
