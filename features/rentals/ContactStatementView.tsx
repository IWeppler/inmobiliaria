import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE, formatDate, money } from "@/features/rentals/logic";
import { totalsByCurrency, type ContactStatementData, type StatementContract } from "@/features/rentals/contactStatement";
import { StatementTable } from "@/features/rentals/StatementTable";
import { Stat, StatStrip } from "@/features/rentals/StatStrip";

function moneyList(items: [string, number][], empty: string) {
  return items.length ? items.map(([currency, amount]) => money(amount, currency)).join(" + ") : empty;
}

// Cuerpo del estado de cuenta, compartido por la ficha interna y el link
// público. Componente de servidor: se imprime tal cual.
export function ContactStatementView({ data, year, internal, yearHref }: {
  data: ContactStatementData; year: number | null; internal: boolean; yearHref: (year: number | null) => string;
}) {
  const yearLabel = year ? String(year) : null;
  const tenantContracts = data.tenantContracts;
  const ownerContracts = data.ownerContracts;

  return (
    <>
      <nav aria-label="Período del estado de cuenta" className="flex flex-wrap gap-1 print:hidden">
        {[...data.yearOptions, null].map((y) => (
          <Link key={y ?? "todo"} href={yearHref(y)} aria-current={year === y ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", year === y ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {y ?? "Todo"}
          </Link>
        ))}
      </nav>

      {!data.isTenant && !data.isOwner && (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {data.contact.kind === "guarantor"
            ? "Es garante: no tiene cuenta corriente propia."
            : internal ? "Todavía no participa de ningún contrato que administres." : "No hay movimientos para mostrar."}
        </div>
      )}

      {data.isTenant && (
        <section className="space-y-4 break-inside-avoid">
          <h2 className="text-lg font-semibold tracking-tight">{internal ? "Como inquilino" : "Tu alquiler"}</h2>
          <StatStrip className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3">
            <Stat label="Deuda vencida" value={moneyList(totalsByCurrency(data.overdue.map((c) => ({ amount: c.balance, currency: c.currency }))), "Al día")}
              tone={data.overdue.length ? "danger" : undefined}
              detail={data.overdue.length ? `${data.overdue.length} ${data.overdue.length === 1 ? "cargo vencido" : "cargos vencidos"}` : "Sin deuda"} />
            <Stat label="Próximo vencimiento" value={data.upcoming[0] ? money(data.upcoming[0].balance, data.upcoming[0].currency) : "Sin cuotas"}
              detail={data.upcoming[0] ? `${data.upcoming[0].description} · ${formatDate(data.upcoming[0].due_date)}` : undefined} />
            <Stat label="Contratos" value={tenantContracts.length} detail={`${tenantContracts.filter((c) => c.status === "ACTIVO").length} activos`} />
          </StatStrip>
          <ContractList contracts={tenantContracts} internal={internal} />
          {data.tenantStatement.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
          ) : data.tenantStatement.map((statement) => (
            <div key={statement.currency} className="rounded-lg border border-border bg-card p-4">
              {data.tenantStatement.length > 1 && <p className="mb-2 text-sm font-medium">{statement.currency}</p>}
              <StatementTable statement={statement} increaseLabel="Cargos" decreaseLabel="Pagos" yearLabel={yearLabel}
                balanceLabel={statement.closing > 0.005 ? "Saldo deudor" : "Saldo"} empty="Sin movimientos en el período." />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Incluye los cargos vencidos hasta hoy. Las cuotas futuras se suman al vencer.</p>
        </section>
      )}

      {data.isOwner && (
        <section className="space-y-4 break-inside-avoid">
          <h2 className="text-lg font-semibold tracking-tight">{internal ? "Como propietario" : "Tus propiedades"}</h2>
          <StatStrip className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3">
            <Stat label="Pendiente de transferir" value={moneyList(data.owedToOwner, "Nada pendiente")}
              tone={data.owedToOwner.length ? "warning" : undefined} detail="Liquidaciones emitidas sin pagar" />
            <Stat label="Depósitos en custodia" value={moneyList(totalsByCurrency(data.depositsHeld.map((c) => ({ amount: c.deposit_amount, currency: c.currency }))), "Ninguno")}
              detail={data.depositsHeld.length ? `${data.depositsHeld.length} ${data.depositsHeld.length === 1 ? "contrato" : "contratos"}` : "Recibidos y no devueltos"} />
            <Stat label="Propiedades" value={ownerContracts.length} detail={`${ownerContracts.filter((c) => c.status === "ACTIVO").length} con contrato activo`} />
          </StatStrip>
          <ContractList contracts={ownerContracts} internal={internal} />
          {data.ownerStatement.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se emitieron liquidaciones.</p>
          ) : data.ownerStatement.map((statement) => (
            <div key={statement.currency} className="rounded-lg border border-border bg-card p-4">
              {data.ownerStatement.length > 1 && <p className="mb-2 text-sm font-medium">{statement.currency}</p>}
              <StatementTable statement={statement} increaseLabel="A su favor" decreaseLabel="Transferido" yearLabel={yearLabel}
                balanceLabel={statement.closing > 0.005 ? "Saldo a transferir" : "Saldo"} empty="Sin movimientos en el período." />
            </div>
          ))}

          {data.annualRows.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-base font-semibold">Resumen anual</h3>
              <p className="mb-3 text-xs text-muted-foreground">Por año de los períodos liquidados{internal ? ", con su parte de cada concepto" : ""}.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Año</th>
                      <th className="py-2 pr-3 text-right font-medium">Cobrado</th>
                      <th className="py-2 pr-3 text-right font-medium">Honorarios</th>
                      <th className="py-2 pr-3 text-right font-medium">Gastos</th>
                      <th className="py-2 pr-3 text-right font-medium">Neto</th>
                      <th className="py-2 text-right font-medium">Transferido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.annualRows.map((row) => (
                      <tr key={`${row.year}-${row.currency}`} className="border-b border-border-subtle">
                        <td className="py-2 pr-3 font-medium">{row.year}{data.annualRows.some((r) => r.currency !== row.currency) ? ` · ${row.currency}` : ""}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(row.collected, row.currency)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(row.commission, row.currency)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(row.expenses, row.currency)}</td>
                        <td className="py-2 pr-3 text-right font-medium tabular-nums">{money(row.net, row.currency)}</td>
                        <td className="py-2 text-right tabular-nums">{money(row.paid, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ContractList({ contracts, internal }: { contracts: StatementContract[]; internal: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2 print:hidden">
      {contracts.map((c) => {
        const content = <>
          <span className="max-w-[260px] truncate">{c.property?.title ?? "Contrato"}</span>
          <StatusBadge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"}>{CONTRACT_STATUS_LABELS[c.status] ?? c.status}</StatusBadge>
        </>;
        const className = "inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm";
        return (
          <li key={c.id}>
            {internal
              ? <Link href={`/dashboard/alquileres/${c.id}`} className={`${className} hover:bg-muted/50`}>{content}</Link>
              : <span className={className}>{content}</span>}
          </li>
        );
      })}
    </ul>
  );
}
