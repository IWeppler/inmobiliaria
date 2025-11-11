import { FormLogin } from "@/features/auth/formLogin";

const LoginPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <main className="w-full max-w-md p-8 bg-white  shadow-lg rounded-lg">
        <h1 className="text-3xl font-bold text-center mb-6">Ingresar</h1>
        <p className="text-center text-zinc-600 mb-8">
          Ingresa a tu panel de Agente.
        </p>
        <FormLogin />
      </main>
    </div>
  );
};

export default LoginPage;
