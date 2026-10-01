import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/shared/components/ui/sonner";
import { ThemeProvider } from "next-themes";

// Tipografía del producto (panel + login). El sitio público carga la suya
// en app/(public)/layout.tsx y la aplica con el scope `.site-public`.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
