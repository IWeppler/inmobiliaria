"use client";

import { Download } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { downloadCsv } from "@/features/dashboard/reports/exportCsv";

export function ExportCsvButton({
  filename,
  header,
  rows,
  label = "Exportar CSV",
}: {
  filename: string;
  header: string[];
  rows: (string | number | null | undefined)[][];
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, header, rows)}
    >
      <Download aria-hidden />
      {label}
    </Button>
  );
}
