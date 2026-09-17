import { FormLogin } from "@/features/auth/formLogin";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  robots: { index: false, follow: false },
};

const LoginPage = () => {
  return (
    <div className="grid min-h-svh bg-background text-foreground lg:grid-cols-[1.1fr_1fr]">
      {/* Panel visual (solo desktop) */}
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/bgwallpaper1.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 0px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            TerraNova
          </Link>

          <div className="max-w-md space-y-3">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              Tu cartera, tus leads y tu agenda en un solo lugar.
            </h1>
            <p className="text-base text-white/80">
              Panel de gestión para asesores de TerraNova.
            </p>
          </div>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* Marca (solo mobile / tablet) */}
          <Link
            href="/"
            className="mb-10 block text-lg font-semibold tracking-tight lg:hidden"
          >
            TerraNova
          </Link>

          <header className="mb-8 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Iniciar sesión
            </h2>
            <p className="text-sm text-fg-secondary">
              Ingresá con tu cuenta de asesor para acceder al panel.
            </p>
          </header>

          <FormLogin />

          <p className="mt-10 text-center text-xs text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:underline">
              Volver al sitio
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
