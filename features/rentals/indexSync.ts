import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import { addMonths, periodOf } from "@/features/rentals/logic";

// Sincronización de índices de ajuste desde fuentes oficiales.
//   ICL: BCRA, API de estadísticas v4, variable 40 ("Índice para Contratos
//        de Locación", base 30.6.20=1). Serie diaria: se guarda el valor
//        del día 1 de cada mes, que es el que usa el cálculo de ajustes.
//   IPC: INDEC vía la API de series de datos.gob.ar, serie
//        148.3_INIVELNAL_DICI_M_26 (IPC nacional nivel general, base
//        dic. 2016). Mensual, se publica a mediados del mes siguiente.
// Escribe con service_role: corre desde el cron (sin sesión) o desde una
// server action que ya verificó que el usuario es admin. Un valor oficial
// reemplaza a uno cargado a mano para el mismo mes.

const BCRA_ICL_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/40";
const INDEC_IPC_URL = "https://apis.datos.gob.ar/series/api/series/";
const INDEC_IPC_SERIES = "148.3_INIVELNAL_DICI_M_26";
// Contratos de hasta 3 años más el rezago máximo (6 meses).
const HISTORY_MONTHS = 42;
const TIMEOUT_MS = 20000;

type IndexRow = { index_code: "ICL" | "IPC"; period: string; value: number; source: "BCRA" | "INDEC" };

export type IndexSyncResult = {
  icl: { saved: number; latest: string | null; error?: string };
  ipc: { saved: number; latest: string | null; error?: string };
};

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchIcl(from: string, to: string): Promise<IndexRow[]> {
  const json = await fetchJson(`${BCRA_ICL_URL}?desde=${from}&hasta=${to}&limit=3000`) as {
    results?: { detalle?: { fecha: string; valor: number }[] }[];
  };
  const detail = json.results?.[0]?.detalle ?? [];
  return detail
    .filter((d) => d.fecha.endsWith("-01") && Number.isFinite(d.valor) && d.valor > 0)
    .map((d) => ({ index_code: "ICL", period: d.fecha, value: d.valor, source: "BCRA" }));
}

async function fetchIpc(from: string): Promise<IndexRow[]> {
  const json = await fetchJson(`${INDEC_IPC_URL}?ids=${INDEC_IPC_SERIES}&start_date=${from}&limit=1000&format=json`) as {
    data?: [string, number | null][];
  };
  return (json.data ?? [])
    .filter((row): row is [string, number] => typeof row[1] === "number" && row[1] > 0)
    .map(([date, value]) => ({ index_code: "IPC", period: `${date.slice(0, 7)}-01`, value, source: "INDEC" }));
}

async function save(rows: IndexRow[]) {
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from("index_values").upsert(
    rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
    { onConflict: "index_code,period" },
  );
  if (error) throw new Error(error.message);
  return rows.length;
}

// Cada fuente se sincroniza por separado: si una falla, la otra igual se guarda.
export async function syncIndexValues(): Promise<IndexSyncResult> {
  const today = ymdInAppTz();
  const from = addMonths(periodOf(today), -HISTORY_MONTHS);

  const run = async (fetcher: () => Promise<IndexRow[]>) => {
    try {
      const rows = await fetcher();
      const saved = await save(rows);
      const latest = rows.map((row) => row.period).sort().at(-1) ?? null;
      return { saved, latest };
    } catch (error) {
      return { saved: 0, latest: null, error: error instanceof Error ? error.message : "Error desconocido" };
    }
  };

  const [icl, ipc] = await Promise.all([run(() => fetchIcl(from, today)), run(() => fetchIpc(from))]);
  return { icl, ipc };
}
