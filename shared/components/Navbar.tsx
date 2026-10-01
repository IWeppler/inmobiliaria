"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X, Instagram, MessageCircle } from "lucide-react";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { BRAND, whatsappLink } from "@/lib/brand";

const contactWhatsapp = whatsappLink("Hola, quiero hacer una consulta.");

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  // Se esconde al bajar, vuelve al subir.
  const [hidden, setHidden] = useHideOnScroll();
  const reduce = useReducedMotion();

  const navLinks = [
    { href: "/propiedades?tipo=venta", label: "Comprar" },
    { href: "/propiedades?tipo=alquiler", label: "Alquilar" },
    { href: "/tasar", label: "Tasar mi propiedad" },
    { href: "/contacto", label: "Contacto" },
  ];

  return (
    <>
      <motion.nav
        className="w-full fixed top-0 left-0 bg-background/80 backdrop-blur-md z-40"
        initial={false}
        animate={{ y: hidden && !isMobileMenuOpen ? "-100%" : "0%" }}
        transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onFocusCapture={() => setHidden(false)}
      >
        {/* Mismo ancho que el contenido de cada página: la landing usa
            7xl, el listado y las fichas usan el ancho completo. */}
        <div className={`${pathname === "/" ? "max-w-7xl" : "max-w-[1600px]"} mx-auto px-4 md:px-6`}>
          <div className="flex justify-between items-center h-16">
            {/* Logo / Home Link */}
            <Link
              href="/"
              className="text-xl font-clash font-semibold text-foreground"
            >
              {BRAND.name}
            </Link>

            {/* Navigation Links (Desktop) */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium transition-colors text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Mobile Menu Button (Hamburger) */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="text-foreground cursor-pointer"
                aria-label="Abrir menú"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* --- PANEL DE MENÚ MÓVIL--- */}
      {/* `inert` cerrado: fuera del orden de tabulación y del árbol de
          accesibilidad aunque siga montado para la transición. */}
      <div
        id="mobile-menu"
        inert={!isMobileMenuOpen}
        className={`md:hidden fixed inset-0 z-50 flex flex-col bg-background transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex justify-between items-center h-16 px-4 border-b border-border">
          <Link
            href="/"
            className="text-xl font-clash font-semibold text-foreground"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {BRAND.name}
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-foreground cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>

        {/* Contenido del menú (links, botones, redes) */}
        <div className="flex flex-1 flex-col justify-between overflow-y-auto">
          {/* 1. Links de Navegación */}
          <div className="flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-5 text-xl font-semibold border-b border-border ${
                  pathname === link.href
                    ? "text-main"
                    : "text-foreground hover:bg-muted"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <a
              href={contactWhatsapp}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 mb-6
                         bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] transition-all
                         rounded-full font-medium text-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={20} />
              WhatsApp
            </a>

            {BRAND.instagram && (
              <div className="flex justify-center mb-8">
                <a
                  href={`https://instagram.com/${BRAND.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Instagram size={24} />
                  <span className="sr-only">Instagram</span>
                </a>
              </div>
            )}

            {BRAND.address && (
              <p className="text-center text-sm text-muted-foreground">
                {BRAND.address}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
