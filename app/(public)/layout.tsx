import { Footer } from "@/shared/components/Footer";
import { Navbar } from "@/shared/components/Navbar";
import { siteFontVars } from "@/app/fonts/site";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `site-public` aplica los tokens de marca del sitio (colores, radios,
  // tipografía y escala) definidos en globals.css, independientes del
  // panel. `contents` no altera el layout.
  return (
    <div className="site-public contents">
      <style href="site-fonts" precedence="default">
        {siteFontVars()}
      </style>
      <Navbar />
      <main className="flex flex-col min-h-[100dvh] pt-16">{children}</main>
      <Footer />
    </div>
  );
}
