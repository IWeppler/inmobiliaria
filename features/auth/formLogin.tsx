"use client";

import { createClientBrowser } from "@/lib/supabase-browser";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Por favor, ingresa un email válido." }),
  password: z
    .string()
    .min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),
});

type LoginForm = z.infer<typeof loginSchema>;

export function FormLogin() {
  const router = useRouter();
  const supabase = createClientBrowser();
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setAuthError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    setLoading(false);

    if (error) {
      setAuthError(error.message);
    } else {
      router.refresh();
      router.push("/dashboard");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-300 "
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register("email")}
            className="mt-1 block w-full px-3 py-2 text-zinc-300 border border-main rounded-md shadow-sm placeholder-zinc-400 bg-gray-900/70 focus:outline-none focus:ringmain focus:bordermain"
          />
          {errors.email && (
            <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-300"
          >
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            {...register("password")}
            className="mt-1 block w-full px-3 py-2 text-zinc-300 border border-main rounded-md shadow-sm placeholder-zinc-400 bg-gray-900/70 focus:outline-none focus:ringmain focus:bordermain"
          />
          {errors.password && (
            <p className="mt-2 text-sm text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Botón de Submit y Error General */}
        <div>
          {authError && (
            <div className="my-4 text-center text-red-600 bg-red-50 p-3 rounded-md">
              <p>Error al ingresar: Las credenciales son incorrectas.</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer w-full flex justify-center py-3 px-4 border border-transparent rounded-md font-clash font-medium transition-colors duration-500 text-white bg-main hover:bg-main/80 disabled:bg-zinc-400"
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </div>
      </form>
    </>
  );
}
