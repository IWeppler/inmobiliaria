"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, MessageCircle, X } from "lucide-react";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { BRAND, whatsappLink } from "@/lib/brand";
import { CONTACT_CTA_LABEL } from "@/features/public/v2/content";

const NAV_LINKS = [
  { href: "/propiedades?tipo=venta", label: "Comprar" },
  { href: "/propiedades?tipo=alquiler", label: "Alquilar" },
  { href: "/tasar", label: "Tasar mi propiedad" },
];

const WHATSAPP_MESSAGE = "Hola, quería hacer una consulta.";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Se esconde al bajar, vuelve al subir: más espacio para el contenido
  // sin perder la navegación.
  const [hidden, setHidden] = useHideOnScroll();
  const reduce = useReducedMotion();

  // Con el menú móvil abierto: sin scroll de fondo y Escape lo cierra.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-card px-4 py-2 text-sm font-semibold text-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <motion.header
        className="fixed inset-x-0 top-0 z-40 h-16 bg-background/85 backdrop-blur-md"
        initial={false}
        animate={{ y: hidden && !open ? "-100%" : "0%" }}
        transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        // Con teclado: si el foco entra al navbar, se muestra.
        onFocusCapture={() => setHidden(false)}
      >
        <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-6 px-4 md:px-6">
          <Link
            href="/v2"
            className="font-clash text-xl font-semibold tracking-tight text-foreground"
            onClick={() => setOpen(false)}
          >
            {BRAND.name}
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <a
            href={whatsappLink(WHATSAPP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-9 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold whitespace-nowrap text-background transition-[background-color,transform] hover:bg-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] lg:inline-flex"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {CONTACT_CTA_LABEL}
          </a>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="v2-mobile-menu"
            aria-label="Abrir menú"
            className="-mr-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-muted md:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </motion.header>

      {/* Menú móvil a pantalla completa. `inert` cerrado: fuera del foco y de lectores. */}
      <div
        id="v2-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        inert={!open}
        className={`fixed inset-0 z-50 flex flex-col bg-background transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none md:hidden ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link
            href="/v2"
            className="font-clash text-xl font-semibold tracking-tight text-foreground"
            onClick={() => setOpen(false)}
          >
            {BRAND.name}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="-mr-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Principal" className="flex flex-col px-4 pt-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-border py-5 font-clash text-3xl font-semibold tracking-tight text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <a
            href={whatsappLink(WHATSAPP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground text-base font-semibold text-background active:scale-[0.98]"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {CONTACT_CTA_LABEL}
          </a>
          <a href={`mailto:${BRAND.email}`} className="text-center text-sm text-muted-foreground">
            {BRAND.email}
          </a>
        </div>
      </div>
    </>
  );
}
