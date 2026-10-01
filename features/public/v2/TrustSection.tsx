import { STATS, TESTIMONIALS } from "@/features/public/v2/content";
import { Reveal } from "@/features/public/v2/Reveal";

// Prueba social: cifras a la izquierda, una reseña destacada y dos
// secundarias a la derecha. Sin cards: jerarquía por tamaño y espacio.
export function TrustSection() {
  const [featured, ...rest] = TESTIMONIALS;

  return (
    <section aria-labelledby="v2-trust-title" className="w-full bg-background">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-14 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-12 lg:gap-12">
        <Reveal className="lg:col-span-5">
          <h2
            id="v2-trust-title"
            className="max-w-[14ch] font-clash text-4xl leading-[1.05] font-semibold tracking-tight text-foreground md:text-5xl"
          >
            Quienes ya operaron con nosotros
          </h2>

          <dl className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 lg:grid-cols-1">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse gap-1">
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="font-clash text-5xl font-semibold tracking-tight text-foreground">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={0.1} className="flex flex-col gap-12 lg:col-span-7 lg:pt-2">
          <figure>
            <blockquote className="font-clash text-2xl leading-snug font-medium tracking-tight text-foreground md:text-3xl">
              “{featured.quote}”
            </blockquote>
            <figcaption className="mt-5 text-sm">
              <span className="font-semibold text-foreground">{featured.name}</span>
              <span className="text-muted-foreground"> · {featured.role}</span>
            </figcaption>
          </figure>

          <div className="grid grid-cols-1 gap-10 border-t border-border pt-10 md:grid-cols-2">
            {rest.map((t) => (
              <figure key={t.name}>
                <blockquote className="text-base leading-relaxed text-fg-secondary">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-foreground">{t.name}</span>
                  <span className="text-muted-foreground"> · {t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
