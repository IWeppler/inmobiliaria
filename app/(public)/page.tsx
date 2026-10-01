import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClientServer } from "@/lib/supabase";
import { Hero } from "@/features/public/Hero";
import { PropertyCardData } from "@/app/types/entities";
import { Solutions } from "@/features/public/Solutions";
import { Reveal } from "@/features/public/v2/Reveal";
import { PropertyTypeGrid } from "@/features/public/Find";
import { AppraisalBand } from "@/features/public/AppraisalBand";
import { LatestPropertiesSlider } from "@/features/public/LatestPropertiesSlider";

// Tope del slider de últimas propiedades; el resto queda en "Ver todas".
const LATEST_LIMIT = 10;

export default async function Home() {
  const supabase = await createClientServer();

  const { data: properties, error } = await supabase
    .from("properties")
    .select(
      `
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
    `,
    )
    .eq("status", "EN_VENTA")
    .order("created_at", { ascending: false })
    .limit(LATEST_LIMIT);

  if (error) {
    console.error("Error al cargar propiedades:", error.message);
  }

  const safeProperties = (properties ?? []) as PropertyCardData[];

  return (
    <div className="flex w-full flex-col">
      <Hero />

      <section className="relative -mt-px w-full overflow-hidden bg-foreground text-background pt-16 pb-16 md:pt-24 md:pb-24">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          {safeProperties.length > 0 ? (
            <Reveal>
              <LatestPropertiesSlider properties={safeProperties} />
            </Reveal>
          ) : (
            <Reveal>
              <h2 className="mb-10 font-clash text-4xl font-semibold md:text-5xl">
                Nuevas propiedades
              </h2>
              <div className="rounded-2xl border border-background/15 px-6 py-12 text-center">
                <p className="text-background/65">
                  No hay propiedades en venta publicadas en este momento.
                </p>
                <Link
                  href="/propiedades"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-background underline-offset-4 hover:underline"
                >
                  Ver todo el catálogo <ArrowRight className="size-4" />
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <PropertyTypeGrid />

      <Solutions />

      <AppraisalBand />
    </div>
  );
}
