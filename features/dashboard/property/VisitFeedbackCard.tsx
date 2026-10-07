import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatDate } from "@/features/rentals/logic";
import { OUTCOME_LABELS, OUTCOME_TONE, type VisitOutcome } from "@/features/dashboard/leads/followUp";

export type VisitFeedback = { id: string; day: string; outcome: string; note: string | null };

// Cómo salieron las visitas de la propiedad: conteo por resultado y los
// últimos comentarios. Material para ajustar precio o presentación y para
// el informe al propietario.
export function VisitFeedbackCard({ visits }: { visits: VisitFeedback[] }) {
  if (!visits.length) return null;
  const counts = new Map<string, number>();
  for (const v of visits) counts.set(v.outcome, (counts.get(v.outcome) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const comments = visits.filter((v) => v.note).slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Devoluciones de visitas
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">{visits.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {ordered.map(([outcome, n]) => (
            <StatusBadge key={outcome} tone={OUTCOME_TONE[outcome as VisitOutcome] ?? "neutral"}>
              {OUTCOME_LABELS[outcome as VisitOutcome] ?? outcome} · {n}
            </StatusBadge>
          ))}
        </div>
        {comments.length > 0 && (
          <ul className="space-y-2 border-t border-border-subtle pt-3">
            {comments.map((c) => (
              <li key={c.id}>
                <span className="text-xs text-muted-foreground">{formatDate(c.day)} · {OUTCOME_LABELS[c.outcome as VisitOutcome] ?? c.outcome}</span>
                <p className="text-fg-secondary">{c.note}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
