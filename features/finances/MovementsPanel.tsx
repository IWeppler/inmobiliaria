"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Pause, Pencil, Play, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/lib/utils";
import { money, formatDate } from "@/features/rentals/logic";
import { deleteMovementAction, deleteRecurringExpenseAction, updateRecurringExpenseAction } from "./actions";
import { CATEGORIES, fullArs, toArs, type Category } from "./logic";
import { MovementDialog, type MovementDraft, type PropertyOption } from "./MovementDialog";
import { CloseSaleDialog, type SaleProperty } from "./CloseSaleDialog";

export type MovementListRow = {
  id: string;
  occurred_on: string;
  direction: string;
  category: string;
  nature: string | null;
  description: string;
  amount: number;
  currency: string;
  settlement_id: string | null;
  sale_id: string | null;
  recurring_expense_id: string | null;
  contract_id: string | null;
  properties: { id: string; title: string } | null;
};

export type RecurringExpenseRow = {
  id: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  day_of_month: number;
  active: boolean;
};

export type PendingSale = SaleProperty & { soldOn: string };

// Finanzas: ventas sin cerrar, gastos fijos y movimientos. Las ventas
// pendientes son propiedades que pasaron a VENDIDO sin cierre de venta
// (ej. cambiadas desde el formulario de edición).
export function MovementsPanel({
  movements,
  recurring,
  pendingSales,
  properties,
  today,
  usdToArs,
}: {
  movements: MovementListRow[];
  recurring: RecurringExpenseRow[];
  pendingSales: PendingSale[];
  properties: PropertyOption[];
  today: string;
  usdToArs: number;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ draft?: MovementDraft } | null>(null);
  const [sale, setSale] = useState<SaleProperty | null>(null);

  const run = async (action: Promise<{ success: boolean; message: string }>) => {
    const res = await action;
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <div className="flex flex-col gap-5">
      {pendingSales.length > 0 && (
        <section className="rounded-lg border border-warning-border bg-warning-bg">
          <div className="border-b border-warning-border px-4 py-2.5">
            <h2 className="text-sm font-semibold text-warning">
              {pendingSales.length === 1 ? "1 venta sin cerrar" : `${pendingSales.length} ventas sin cerrar`}
            </h2>
            <p className="text-xs text-fg-secondary">Pasaron a Vendido sin registrar precio ni comisión.</p>
          </div>
          <ul className="divide-y divide-warning-border">
            {pendingSales.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <Link href={`/dashboard/propiedades/${s.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {s.title}
                  </Link>
                  <span className="text-fg-secondary"> · vendida el {formatDate(s.soldOn)}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setSale(s)}>
                  Cerrar venta
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecurringExpenses rows={recurring} usdToArs={usdToArs} onRun={run} onAdd={() => setDialog({ draft: { category: "SUELDOS" } })} />

      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-base font-semibold tracking-tight">Movimientos</h2>
          <Button size="sm" onClick={() => setDialog({})}>
            <Plus />
            Nuevo movimiento
          </Button>
        </div>
        {movements.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos. Las comisiones aparecen solas al liquidar alquileres o cerrar ventas.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {movements.map((m) => {
              const meta = CATEGORIES[m.category as Category];
              const isIncome = m.direction === "INGRESO";
              const auto = m.settlement_id
                ? { href: `/dashboard/alquileres/${m.contract_id}`, title: "Generado desde una liquidación" }
                : m.sale_id
                  ? { href: `/dashboard/propiedades/${m.properties?.id}`, title: "Generado desde el cierre de venta" }
                  : null;
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{formatDate(m.occurred_on)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{m.description}</span>
                      {m.nature === "FIJO" && <Badge variant="neutral" className="shrink-0">Fijo</Badge>}
                    </p>
                    <p className="truncate text-xs text-fg-secondary">
                      {meta?.label ?? m.category}
                      {m.properties && <> · {m.properties.title}</>}
                    </p>
                  </div>
                  <span className={cn("shrink-0 font-semibold tabular-nums", isIncome ? "text-success" : "text-foreground")}>
                    {isIncome ? "+" : "−"}{money(m.amount, m.currency)}
                  </span>
                  {auto ? (
                    <Link
                      href={auto.href}
                      title={auto.title}
                      aria-label={auto.title}
                      className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <Zap className="size-3.5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => run(deleteMovementAction(m.id))}
                      className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-danger"
                      aria-label="Eliminar movimiento"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog && (
        <MovementDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          properties={properties}
          today={today}
          draft={dialog.draft}
        />
      )}
      {sale && <CloseSaleDialog open onOpenChange={(open) => !open && setSale(null)} property={sale} />}
    </div>
  );
}

// Plantillas de gastos fijos. El total mensual (en ARS) es el piso que el
// negocio tiene que cubrir cada mes.
function RecurringExpenses({
  rows,
  usdToArs,
  onRun,
  onAdd,
}: {
  rows: RecurringExpenseRow[];
  usdToArs: number;
  onRun: (action: Promise<{ success: boolean; message: string }>) => Promise<void>;
  onAdd: () => void;
}) {
  const [editing, setEditing] = useState<{ id: string; amount: string } | null>(null);
  const monthly = rows.filter((r) => r.active).reduce((sum, r) => sum + toArs(r.amount, r.currency, usdToArs), 0);

  const saveAmount = async () => {
    if (!editing || !(Number(editing.amount) > 0)) return;
    await onRun(updateRecurringExpenseAction({ id: editing.id, amount: Number(editing.amount) }));
    setEditing(null);
  };

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <h2 className="flex items-baseline gap-2 text-base font-semibold tracking-tight">
          Gastos fijos
          {rows.length > 0 && (
            <span className="text-sm font-normal tabular-nums text-fg-secondary">{fullArs(monthly)} / mes</span>
          )}
        </h2>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus />
          Gasto fijo
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Cargá sueldos, alquiler de oficina o suscripciones una sola vez y se registran solos cada mes.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm", !r.active && "opacity-60")}>
              <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.description}</p>
                <p className="truncate text-xs text-fg-secondary">
                  {CATEGORIES[r.category as Category]?.label ?? r.category} · día {r.day_of_month}
                  {!r.active && " · pausado"}
                </p>
              </div>
              {editing?.id === r.id ? (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveAmount();
                  }}
                >
                  <Input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.amount}
                    onChange={(e) => setEditing({ id: r.id, amount: e.target.value })}
                    onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                    className="h-7 w-32"
                    aria-label="Nuevo monto"
                  />
                  <Button type="submit" size="sm" className="h-7">OK</Button>
                </form>
              ) : (
                <span className="shrink-0 font-semibold tabular-nums">−{money(r.amount, r.currency)}</span>
              )}
              <div className="flex shrink-0 items-center">
                <IconButton label="Editar monto" onClick={() => setEditing({ id: r.id, amount: String(r.amount) })}>
                  <Pencil className="size-3.5" />
                </IconButton>
                <IconButton
                  label={r.active ? "Pausar" : "Reactivar"}
                  onClick={() => onRun(updateRecurringExpenseAction({ id: r.id, active: !r.active }))}
                >
                  {r.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </IconButton>
                <IconButton label="Eliminar" danger onClick={() => onRun(deleteRecurringExpenseAction(r.id))}>
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-sm text-muted-foreground",
        danger ? "hover:text-danger" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
