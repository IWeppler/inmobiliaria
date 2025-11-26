"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Facebook, Instagram } from "lucide-react";

const whatsappLink = `https://wa.me/+541154702118?text=Hola, estoy interesado en la propiedad...`;

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/propiedades?tipo=venta", label: "Comprar" },
    { href: "/propiedades?tipo=alquiler", label: "Alquilar" },
    { href: "/tasar", label: "Tasar mi propiedad" },
    { href: "/contacto", label: "Contacto" },
  ];

  return (
    <>
      <nav className="w-full fixed top-0 left-0 bg-background/80 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Home Link */}
            <Link href="/" className="text-xl font-clash font-semibold text-foreground">
              TerraNova
            </Link>

            {/* Navigation Links (Desktop) */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors text-zinc-600 hover:text-black`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Mobile Menu Button (Hamburger) */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="text-black cursor-pointer"
                aria-label="Abrir menú"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* --- PANEL DE MENÚ MÓVIL (PANTALLA COMPLETA) --- */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-white transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex justify-between items-center h-16 px-4 sm:px-6 border-b ">
          <Link
            href="/"
            className="text-2xl font-bold text-foreground"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            TerraNova
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-black  cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>

        {/* Contenido del menú (links, botones, redes) */}
        <div className="flex flex-col justify-between h-[calc(100vh-4rem)]">
          {/* 1. Links de Navegación */}
          <div className="flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-5 text-xl font-semibold border-b  ${
                  pathname === link.href
                    ? "text-main"
                    : "text-zinc-800  hover:bg-zinc-100"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pb-10">
            <Link
              href={whatsappLink}
              className="flex items-center justify-center w-full px-4 py-3 mb-6
                         bg-black text-white hover:bg-green-600 transition-colors duration-300
                         rounded-full font-medium text-lg  max-w-md md:max-w-none mx-auto"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="icon icon-tabler icons-tabler-outline icon-tabler-brand-whatsapp mr-2"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
                <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
              </svg>{" "}
              Contactar
            </Link>

            {/* Redes Sociales */}
            <div className="flex justify-center space-x-6 mb-6">
              <Link
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-black"
              >
                <Facebook size={24} />
              </Link>
              <Link
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-black"
              >
                <Instagram size={24} />
              </Link>
            </div>

            {/* Dirección (del footer) */}
            <div className="text-center text-sm text-zinc-500 ">
              <p>Gobernador Crespo 1658</p>
              <p>Tostado, Santa Fe, Argentina</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
