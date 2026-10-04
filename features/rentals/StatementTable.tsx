import Link from "next/link";
import { formatDate, money } from "@/features/rentals/logic";
import type { CurrencyStatement } from "@/features/rentals/statement";

// Tabla de estado de cuenta (una por moneda). Componente de servidor:
// se imprime tal cual con "Imprimir / guardar PDF".
export function StatementTable({ statement, increaseLabel, decreaseLabel, balanceLabel, yearLabel, empty }: {
  statement: CurrencyStatement;
  increaseLabel: string;
  decreaseLabel: string;
  balanceLabel: string;
  yearLabel: string | null;
  empty: string;
}) {
  const { currency, opening, rows } = statement;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 font-medium">Concepto</th>
            <th className="py-2 pr-3 text-right font-medium">{increaseLabel}</th>
            <th className="py-2 pr-3 text-right font-medium">{decreaseLabel}</th>
            <th className="py-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {yearLabel && (
            <tr className="border-b border-border-subtle text-muted-foreground">
              <td className="py-2 pr-3" colSpan={4}>Saldo al inicio de {yearLabel}</td>
              <td className="py-2 text-right tabular-nums">{money(opening, currency)}</td>
            </tr>
          )}
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">{empty}</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id} className="border-b border-border-subtle align-top">
              <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-muted-foreground">{formatDate(row.date)}</td>
              <td className="py-2 pr-3">
                {row.href ? <Link href={row.href} className="hover:underline print:no-underline">{row.description}</Link> : row.description}
                {row.detail && <span className="block text-xs text-muted-foreground">{row.detail}</span>}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.increase ? money(row.increase, currency) : ""}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.decrease ? money(row.decrease, currency) : ""}</td>
              <td className="py-2 text-right font-medium tabular-nums">{money(row.balance, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/80 font-semibold">
            <td className="py-2 pr-3" colSpan={2}>{balanceLabel}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{money(statement.increases, currency)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{money(statement.decreases, currency)}</td>
            <td className="py-2 text-right tabular-nums">{money(statement.closing, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
