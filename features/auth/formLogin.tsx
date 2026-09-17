"use client";

import { createClientBrowser } from "@/lib/supabase-browser";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Ingresá un email válido." }),
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
  const [showPassword, setShowPassword] = useState(false);

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

    if (error) {
      setLoading(false);
      setAuthError("Email o contraseña incorrectos. Revisá los datos e intentá de nuevo.");
      return;
    }

    // Mantenemos loading hasta que navega para que el botón no "rebote"
    router.refresh();
    router.push("/dashboard");
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
    >
      {authError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{authError}</p>
        </div>
      )}

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          placeholder="vos@inmobiliaria.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="h-9"
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Contraseña */}
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="h-9 pr-9"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="mt-2 w-full cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Ingresando…
          </>
        ) : (
          "Iniciar sesión"
        )}
      </Button>
    </form>
  );
}
