"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";
import { ContactPicker } from "@/features/rentals/ContractForm";
import { setPropertyOwnersAction } from "@/features/rentals/propertyOwnerActions";
import type { PropertyOwner } from "@/features/rentals/propertyOwners";

type Option = { id: string; label: string };
type Row = { key: string; contact_id: string; share_pct: number; is_primary: boolean };

const toRows = (owners: PropertyOwner[]): Row[] =>
  owners.map((o) => ({ key: o.contact_id, contact_id: o.contact_id, share_pct: o.share_pct, is_primary: o.is_primary }));

// Titulares de la propiedad. Los contratos nuevos los copian; los ya
// firmados conservan los titulares con los que se firmaron.
export function PropertyOwnersCard({ propertyId, owners, contacts }: {
  propertyId: string; owners: PropertyOwner[]; contacts: Option[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>(toRows(owners));

  const total = rows.reduce((sum, r) => sum + (Number(r.share_pct) || 0), 0);
  const valid = rows.length > 0 && rows.every((r) => r.contact_id && r.share_pct > 0)
    && Math.abs(total - 100) < 0.001 && rows.filter((r) => r.is_primary).length === 1;

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const start = () => {
    setRows(owners.length ? toRows(owners) : [{ key: crypto.randomUUID(), contact_id: "", share_pct: 100, is_primary: true }]);
    setEditing(true);
  };

  const addRow = () => setRows((prev) => [...prev, { key: crypto.randomUUID(), contact_id: "", share_pct: Math.max(0, 100 - total), is_primary: false }]);

  const removeRow = (key: string) => setRows((prev) => {
    const next = prev.filter((r) => r.key !== key);
    // Si se quita el principal, pasa a serlo el primero que quede.
    if (next.length && !next.some((r) => r.is_primary)) next[0] = { ...next[0], is_primary: true };
    return next;
  });

  const save = async () => {
    setSaving(true);
    const res = await setPropertyOwnersAction({
      property_id: propertyId,
      owners: rows.map(({ contact_id, share_pct, is_primary }) => ({ contact_id, share_pct, is_primary })),
    });
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{owners.length > 1 ? "Propietarios" : "Propietario"}</CardTitle>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={start}>{owners.length ? "Editar" : "Cargar"}</Button>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {!editing ? (
          owners.length === 0 ? (
            <p className="text-muted-foreground">Sin dueño cargado. Se completa solo al crear el primer contrato, o cargalo ahora.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {owners.map((o) => (
                <li key={o.contact_id} className="flex h-9 items-center justify-between gap-3">
                  <Link href={`/dashboard/alquileres/contactos/${o.contact_id}`} className="truncate font-medium underline-offset-4 hover:underline">
                    {o.full_name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {owners.length > 1 && `${o.share_pct.toLocaleString("es-AR")} %`}
                    {owners.length > 1 && o.is_primary && " · principal"}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-4">
            {rows.map((row, index) => (
              <div key={row.key} className="space-y-2 border-b border-border-subtle pb-4">
                <ContactPicker
                  kind="owner"
                  label={index === 0 ? "Titular" : `Titular ${index + 1}`}
                  options={contacts}
                  value={row.contact_id}
                  onChange={(id) => update(row.key, { contact_id: id })}
                />
                <div className="flex items-center gap-2">
                  <Input type="number" min={0.01} max={100} step="0.01" className="w-24" aria-label="Porcentaje"
                    value={row.share_pct || ""} onChange={(e) => update(row.key, { share_pct: Number(e.target.value) })} />
                  <span className="text-muted-foreground">%</span>
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="radio" name={`primary-${propertyId}`} checked={row.is_primary}
                      onChange={() => setRows((prev) => prev.map((r) => ({ ...r, is_primary: r.key === row.key })))} />
                    Principal
                  </label>
                  {rows.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Quitar titular" onClick={() => removeRow(row.key)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="outline" onClick={addRow}><Plus className="size-4" /> Copropietario</Button>
              <span className={cn("tabular-nums", Math.abs(total - 100) < 0.001 ? "text-muted-foreground" : "text-danger")}>
                Total {total.toLocaleString("es-AR")} %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              El principal recibe las comunicaciones y los centavos de redondeo de las liquidaciones. Los contratos vigentes no cambian.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
              <Button type="button" onClick={save} disabled={!valid || saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Guardar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
