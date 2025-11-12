import { FormLogin } from "@/features/auth/formLogin";
import Image from "next/image";

const LoginPage = () => {
  return (
    <div className="flex min-h-screen font-sans">
      {/* Columna izquierda */}
      <div className="hidden md:flex relative w-1/2 items-center justify-center bg-foreground">
        <Image
          src="/bgwallpaper1.jpg"
          alt="background inmobiliaria"
          fill
          className="object-cover p-8"
        />
        <div className="absolute inset-0 bg-black/40 m-8" />
        <div className="relative z-10 text-white text-center px-6">
          <h1 className="text-4xl font-bold mb-4">Inmobiliaria</h1>
          <p className="text-lg text-gray-200">
            Gestioná tus propiedades con una plataforma moderna y simple.
          </p>
        </div>
      </div>

      {/* Columna derecha */}
      <div className="flex w-full md:w-1/2 items-center justify-center bg-background">
        <main className="w-full max-w-md px-8 py-16 bg-foreground">
          <h2 className="text-3xl font-bold text-center mb-2 text-background">
            Hola!
          </h2>
          <p className="text-lg text-center text-zinc-300 mb-6">
            Accedé a tu panel de agente
          </p>
          <FormLogin />
        </main>
      </div>
    </div>
  );
};

export default LoginPage;
