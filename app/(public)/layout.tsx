import { Footer } from "@/shared/components/Footer";
import { Navbar } from "@/shared/components/Navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `site-public` restaura la tipografía y escala de marca (General Sans,
  // tamaños de Tailwind) fuera del producto. `contents` no altera el layout.
  return (
    <div className="site-public contents">
      <Navbar />
      <main className="flex flex-col min-h-screen pt-18">{children}</main>
      <Footer />
    </div>
  );
}
