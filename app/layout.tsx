import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/shared/components/ui/sonner";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://terranova-demo.vercel.app'),
  title: {
    default: 'TerraNova | Inmobiliaria Rural y Urbana',
    template: '%s | TerraNova', 
  },
  description: 'Encuentra los mejores campos y propiedades en Santa Fe y Santiago del Estero.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light" style={{ colorScheme: "light" }}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@500,600,700&f[]=general-sans@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}