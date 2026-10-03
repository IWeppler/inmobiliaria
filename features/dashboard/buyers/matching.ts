// Buyer Intelligence: compatibilidad entre una propiedad y la demanda que un
// lead dejó cargada. Función pura (sin DB) para poder razonarla y testearla.
//
// Requisitos duros (operación, tipo, zona, tope de presupuesto) descartan.
// Lo blando (dormitorios, baños) puntúa. Solo cuenta lo que el comprador
// especificó: no se premia ni castiga lo que dejó vacío. Al final el score
// se pondera por la vigencia de la búsqueda.

export type BuyerDemand = {
  operation: string | null;
  typeIds: number[];
  locations: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string | null;
  bedroomsMin: number | null;
  bathroomsMin: number | null;
  financing: boolean | null;
  urgency: string | null;
  confirmedAt: string | null;
};

export type MatchableProperty = {
  operation_type: string | null;
  property_type_id: number | null;
  city: string | null;
  neighborhood: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
};

export type MatchReason = { ok: boolean; text: string };

export type MatchResult = {
  eligible: boolean;
  score: number; // 0–100, ya ponderado por vigencia
  rawScore: number; // 0–100, solo compatibilidad
  stale: boolean; // búsqueda sin confirmar hace mucho
  daysSinceConfirmed: number | null;
  reasons: MatchReason[];
};

// El comprador estira el tope un poco; más allá de esto no se considera.
const BUDGET_TOLERANCE = 0.1;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function toUsd(amount: number, currency: string | null, usdToArs: number | null) {
  if ((currency ?? "USD").toUpperCase() === "USD") return amount;
  return usdToArs && usdToArs > 0 ? amount / usdToArs : null;
}

export function freshnessFactor(days: number | null) {
  if (days === null) return 0.6;
  if (days <= 30) return 1;
  if (days <= 90) return 0.9;
  if (days <= 180) return 0.75;
  return 0.55;
}

export function hasDemand(d: BuyerDemand) {
  return !!d.operation;
}

export function scoreMatch(
  property: MatchableProperty,
  demand: BuyerDemand,
  opts: { usdToArs: number | null; now?: Date },
): MatchResult {
  const reasons: MatchReason[] = [];
  const out = (eligible: boolean): MatchResult => ({
    eligible,
    score: 0,
    rawScore: 0,
    stale: false,
    daysSinceConfirmed: null,
    reasons,
  });

  // Operación (duro)
  if (
    !demand.operation ||
    (property.operation_type ?? "").toLowerCase() !== demand.operation
  ) {
    return out(false);
  }

  let earned = 0;
  let possible = 0;
  const add = (weight: number, fraction: number) => {
    possible += weight;
    earned += weight * fraction;
  };

  // Tipo (duro)
  if (demand.typeIds.length) {
    if (!property.property_type_id || !demand.typeIds.includes(property.property_type_id)) {
      return out(false);
    }
    add(15, 1);
    reasons.push({ ok: true, text: "Tipo de propiedad" });
  }

  // Zona (duro): ciudad o barrio, sin tildes ni mayúsculas
  if (demand.locations.length) {
    const places = [property.city, property.neighborhood].filter(Boolean).map((p) => norm(p!));
    const hit = demand.locations.some((l) => places.some((p) => p.includes(norm(l)) || norm(l).includes(p)));
    if (!hit) return out(false);
    add(30, 1);
    reasons.push({ ok: true, text: "Zona buscada" });
  }

  // Presupuesto: el tope es duro (con tolerancia); lo barato nunca resta
  if (demand.budgetMax && property.price) {
    const price = toUsd(property.price, property.currency, opts.usdToArs);
    const max = toUsd(demand.budgetMax, demand.currency, opts.usdToArs);
    if (price !== null && max !== null) {
      if (price <= max) {
        add(30, 1);
        reasons.push({ ok: true, text: "Dentro del presupuesto" });
      } else if (price <= max * (1 + BUDGET_TOLERANCE)) {
        const over = Math.round((price / max - 1) * 100);
        add(30, 0.5);
        reasons.push({ ok: false, text: `${over}% sobre su tope` });
      } else {
        return out(false);
      }
    }
  }

  // Dormitorios y baños: blandos
  if (demand.bedroomsMin) {
    const have = property.bedrooms ?? 0;
    if (have >= demand.bedroomsMin) {
      add(15, 1);
      reasons.push({ ok: true, text: `${have} dormitorios` });
    } else {
      add(15, have === demand.bedroomsMin - 1 ? 0.4 : 0);
      reasons.push({ ok: false, text: `Busca ${demand.bedroomsMin}+ dormitorios, tiene ${have}` });
    }
  }
  if (demand.bathroomsMin) {
    const have = property.bathrooms ?? 0;
    add(5, have >= demand.bathroomsMin ? 1 : 0);
    reasons.push({
      ok: have >= demand.bathroomsMin,
      text: have >= demand.bathroomsMin ? "Baños" : `Busca ${demand.bathroomsMin}+ baños, tiene ${have}`,
    });
  }

  // Sin ningún criterio más allá de la operación, el match es débil.
  const rawScore = possible === 0 ? 40 : Math.round((earned / possible) * 100);

  const now = opts.now ?? new Date();
  const days = demand.confirmedAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(demand.confirmedAt).getTime()) / 86_400_000))
    : null;

  return {
    eligible: true,
    rawScore,
    score: Math.round(rawScore * freshnessFactor(days)),
    stale: days === null || days > 180,
    daysSinceConfirmed: days,
    reasons,
  };
}

// Más urgentes primero a igual score.
const URGENCY_RANK: Record<string, number> = { alta: 2, media: 1, baja: 0 };
export function compareMatches(
  a: { score: number; urgency: string | null },
  b: { score: number; urgency: string | null },
) {
  return b.score - a.score || (URGENCY_RANK[b.urgency ?? ""] ?? -1) - (URGENCY_RANK[a.urgency ?? ""] ?? -1);
}

export function demandFromLead(l: {
  search_operation: string | null;
  search_type_ids: number[] | null;
  search_locations: string[] | null;
  search_budget_min: number | null;
  search_budget_max: number | null;
  search_currency: string | null;
  search_bedrooms_min: number | null;
  search_bathrooms_min: number | null;
  search_financing: boolean | null;
  search_urgency: string | null;
  search_confirmed_at: string | null;
}): BuyerDemand {
  return {
    operation: l.search_operation,
    typeIds: l.search_type_ids ?? [],
    locations: l.search_locations ?? [],
    budgetMin: l.search_budget_min,
    budgetMax: l.search_budget_max,
    currency: l.search_currency,
    bedroomsMin: l.search_bedrooms_min,
    bathroomsMin: l.search_bathrooms_min,
    financing: l.search_financing,
    urgency: l.search_urgency,
    confirmedAt: l.search_confirmed_at,
  };
}
