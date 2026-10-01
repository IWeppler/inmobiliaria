import Link from "next/link";
import { MapPin, Phone, Mail, Instagram } from "lucide-react";
import { BRAND } from "@/lib/brand";

// Colores de texto derivados de los tokens del sitio (fondo casi negro,
// texto blanco roto) para que el gris sea el mismo tono cálido que el
// resto de la página.
const linkClass = "text-background/65 hover:text-background hover:underline";
const headingClass = "text-md font-semibold text-background uppercase mb-4";

export const Footer = () => {
  return (
    <footer className="bg-foreground text-background/65 rounded-t-4xl mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 py-12 md:px-6 md:pt-24">
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-10 mb-10 ${
            BRAND.instagram ? "lg:grid-cols-4" : "lg:grid-cols-3"
          }`}
        >
          {/* 1. Logo/Nombre */}
          <div>
            <Link
              href="/"
              className="text-background text-2xl font-clash font-semibold whitespace-nowrap"
            >
              {BRAND.name}
            </Link>
            <p className="mt-4 text-sm">{BRAND.tagline}</p>
          </div>

          {/* 2. Navegación */}
          <div>
            <h3 className={headingClass}>Navegación</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/propiedades" className={linkClass}>
                  Propiedades
                </Link>
              </li>
              <li>
                <Link href="/tasar" className={linkClass}>
                  Tasar mi propiedad
                </Link>
              </li>
              <li>
                <Link href="/contacto" className={linkClass}>
                  Contacto
                </Link>
              </li>
              <li>
                <Link href="/login" className={linkClass}>
                  Ingresar
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. Contacto */}
          <div>
            <h3 className={headingClass}>Contacto</h3>
            <ul className="space-y-3 text-sm">
              {BRAND.address && (
                <li className="flex items-start">
                  <MapPin size={16} className="mr-2 mt-0.5 shrink-0" />
                  <span>{BRAND.address}</span>
                </li>
              )}
              <li className="flex items-center">
                <Phone size={16} className="mr-2 shrink-0" />
                <a href={`tel:+${BRAND.whatsapp}`} className={linkClass}>
                  {BRAND.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center">
                <Mail size={16} className="mr-2 shrink-0" />
                <a href={`mailto:${BRAND.email}`} className={linkClass}>
                  {BRAND.email}
                </a>
              </li>
            </ul>
          </div>

          {/* 4. Redes Sociales */}
          {BRAND.instagram && (
            <div>
              <h3 className={headingClass}>Seguinos</h3>
              <a
                href={`https://instagram.com/${BRAND.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-background/65 hover:text-background transition-colors"
              >
                <Instagram size={24} />
                <span className="sr-only">Instagram</span>
              </a>
            </div>
          )}
        </div>

        <hr className="my-12 border-background/15" />

        {/* Sección Inferior - Copyright y Créditos */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
          <span className="text-center sm:text-left">
            © {new Date().getFullYear()}{" "}
            <Link href="/" className={linkClass}>
              {BRAND.name}
            </Link>
            . Todos los derechos reservados.
          </span>
          <span className="text-center sm:text-right">
            Diseño y Desarrollo por{" "}
            <Link
              href="https://www.ignacioweppler.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-background hover:underline"
            >
              Ignacio Weppler
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
};
