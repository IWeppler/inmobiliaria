import type { Metadata } from "next";
import { createClientServer } from "@/lib/supabase";
import { HeroV2 } from "@/features/public/v2/HeroV2";
import { LatestListings } from "@/features/public/v2/LatestListings";
import { TypeBento } from "@/features/public/v2/TypeBento";
import { AppraisalBand } from "@/features/public/v2/AppraisalBand";
import { TrustSection } from "@/features/public/v2/TrustSection";
import { ContactClose } from "@/features/public/v2/ContactClose";
import type { PropertyCardData } from "@/app/types/entities";

// Landing en rediseño. Vive aparte de "/" hasta aprobarla; noindex para
// no competir con la home en buscadores.
export const metadata: Metadata = {
  title: "Inicio (v2)",
  robots: { index: false, follow: false },
};

const CARD_FIELDS = `
  id,
  title,
  price,
  currency,
  bedrooms,
  bathrooms,
  total_area,
  city,
  street_address,
  status,
  property_images ( image_url, order )
`;

async function latestByStatus(status: "EN_VENTA" | "EN_ALQUILER") {
  const supabase = await createClientServer();
  const { data, error } = await supabase
    .from("properties")
    .select(CARD_FIELDS)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error(`Error al cargar propiedades ${status}:`, error.message);
  }
  return (data ?? []) as PropertyCardData[];
}

export default async function HomeV2() {
  const [sale, rent] = await Promise.all([latestByStatus("EN_VENTA"), latestByStatus("EN_ALQUILER")]);

  return (
    <div className="flex w-full flex-col">
      <HeroV2 />
      <LatestListings sale={sale} rent={rent} />
      <TypeBento />
      <TrustSection />
      <AppraisalBand />
      <ContactClose />
    </div>
  );
}
