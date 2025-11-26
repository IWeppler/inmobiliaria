/* app/layout.tsx */
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/shared/components/ui/sonner";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "TerraNova - Tu Portal Inmobiliario",
  description: "Encuentra la propiedad de tus sueños.",
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