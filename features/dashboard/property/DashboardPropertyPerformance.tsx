import Image from "next/image";
import Link from "next/link";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { propertyStatusMeta } from "@/features/dashboard/property/propertyStatus";

export type DashboardPropertyRow = {
  id: string;
  title: string;
  location: string;
  type: string;
  activeLeads: number;
  views: number;
  status: string;
  imageUrl: string | null;
};

export function DashboardPropertyPerformance({
  properties,
}: {
  properties: DashboardPropertyRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Propiedad</TableHead>
          <TableHead className="hidden md:table-cell">Tipo</TableHead>
          <TableHead className="text-right">Leads activos</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Vistas</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {properties.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
              Todavía no hay propiedades cargadas.
            </TableCell>
          </TableRow>
        ) : (
          properties.map((property) => {
            const status = propertyStatusMeta(property.status);
            return (
              <TableRow key={property.id}>
                <TableCell>
                  <div className="flex min-w-[220px] items-center gap-3">
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                      {property.imageUrl && (
                        <Image
                          src={property.imageUrl}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/propiedades/${property.id}`}
                        className="block truncate font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {property.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {property.location || "Sin ubicación"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-fg-secondary md:table-cell">
                  {property.type}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {property.activeLeads}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-fg-secondary sm:table-cell">
                  {property.views}
                </TableCell>
                <TableCell>
                  <StatusBadge icon={status.icon} color={status.color}>
                    {status.label}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
