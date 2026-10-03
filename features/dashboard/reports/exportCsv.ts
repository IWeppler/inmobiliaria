// Separador ";" y BOM: Excel en es-AR abre el archivo con columnas y tildes bien.
function escapeCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
) {
  const body = [header, ...rows]
    .map((row) => row.map(escapeCell).join(";"))
    .join("\r\n");
  const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
