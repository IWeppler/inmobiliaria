// Escala de eje en números redondos (1, 2, 5 × 10^n), con unas 4 marcas.
// `integer` evita marcas fraccionarias en conteos (no existe media consulta).
export function niceScale(max: number, { integer = true } = {}) {
  const target = Math.max(1, max) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  let step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= target) ??
    10 * magnitude;
  if (integer) step = Math.max(1, Math.round(step));
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { top, ticks };
}
