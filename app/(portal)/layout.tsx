import type { Metadata } from "next";

// Páginas para clientes de la inmobiliaria (links privados): sin el panel
// ni el sitio público alrededor, y fuera de los buscadores.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-background">{children}</div>;
}
