import { siteFontVars } from "@/app/fonts/site";
import { SiteHeader } from "@/features/public/v2/SiteHeader";
import { SiteFooter } from "@/features/public/v2/SiteFooter";

// Layout de la landing v2 (en rediseño). Mismos tokens y fuentes que el
// sitio público (`site-public`), con navbar y footer nuevos. Cuando se
// apruebe, reemplaza al layout de (public).
export default function LandingV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-public contents">
      <style href="site-fonts" precedence="default">
        {siteFontVars()}
      </style>
      <SiteHeader />
      <main id="contenido" className="flex min-h-[100dvh] flex-col pt-16">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
