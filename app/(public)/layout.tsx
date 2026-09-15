import { Footer } from "@/shared/components/Footer";
import { Navbar } from "@/shared/components/Navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex flex-col min-h-screen pt-18">{children}</main>
      <Footer />
    </>
  );
}
