import Link from "next/link";
import { BRAND, whatsappLink } from "@/lib/brand";

const COLUMNS = [
  {
    title: "Propiedades",
    links: [
      { href: "/propiedades?tipo=venta", label: "Comprar" },
      { href: "/propiedades?tipo=alquiler", label: "Alquilar" },
      { href: "/propiedades", label: "Ver todas" },
    ],
  },
  {
    title: "Propietarios",
    links: [
      { href: "/tasar", label: "Tasar mi propiedad" },
      { href: "/contacto", label: "Contacto" },
      { href: "/login", label: "Ingresar" },
    ],
  },
];

// Footer claro, mismo tema que la página. Solo datos reales de BRAND:
// lo que no está configurado (dirección, Instagram) no se muestra.
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-background">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-6 gap-y-12 px-4 py-14 md:grid-cols-12 md:px-6 md:py-16">
        <div className="col-span-2 md:col-span-5">
          <Link href="/v2" className="font-clash text-2xl font-semibold tracking-tight text-foreground">
            {BRAND.name}
          </Link>
          <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">{BRAND.tagline}</p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="md:col-span-2">
            <h2 className="text-sm font-semibold text-foreground">{col.title}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="col-span-2 md:col-span-3">
          <h2 className="text-sm font-semibold text-foreground">Contacto</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
            <li>
              <a
                href={whatsappLink("Hola, quería hacer una consulta.")}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {BRAND.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${BRAND.email}`} className="transition-colors hover:text-foreground">
                {BRAND.email}
              </a>
            </li>
            {BRAND.address && <li>{BRAND.address}</li>}
            {BRAND.instagram && (
              <li>
                <a
                  href={`https://instagram.com/${BRAND.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  Instagram @{BRAND.instagram}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-border px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between md:px-6">
        <p>
          © {year} {BRAND.name}. Todos los derechos reservados.
        </p>
        <p>
          Diseño y desarrollo por{" "}
          <a
            href="https://www.ignacioweppler.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            Ignacio Weppler
          </a>
        </p>
      </div>
    </footer>
  );
}
