"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { markSettlementPaidAction } from "@/features/rentals/lifecycleActions";
import { formatDate } from "@/features/rentals/logic";
import { useRunAction } from "@/features/rentals/useRunAction";

// Marca / anula la transferencia del neto de una liquidación al propietario.
export function PayoutButton({ settlementId, paidAt, today }: { settlementId: string; paidAt: string | null; today: string }) {
  const { busy, run } = useRunAction();
  if (paidAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        Transferida {formatDate(paidAt)}
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs print:hidden" disabled={!!busy}
          onClick={() => run("payout", () => markSettlementPaidAction({ settlement_id: settlementId, paid_to_owner_at: null, payout_method: null }))}>
          Anular
        </Button>
      </span>
    );
  }
  return (
    <Button size="sm" variant="outline" className="print:hidden" disabled={!!busy}
      onClick={() => run("payout", () => markSettlementPaidAction({ settlement_id: settlementId, paid_to_owner_at: today, payout_method: "TRANSFERENCIA" }))}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : "Marcar transferida"}
    </Button>
  );
}
