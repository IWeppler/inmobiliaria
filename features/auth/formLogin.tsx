'use client' 

import { createClientBrowser } from '@/lib/supabase-browser'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// 1. Definimos el esquema de validación con Zod
const loginSchema = z.object({
  email: z
    .string()
    .email({ message: 'Por favor, ingresa un email válido.' }),
  password: z
    .string()
    .min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
})

// 2. Inferimos el tipo del formulario desde el esquema de Zod
type LoginForm = z.infer<typeof loginSchema>

export function FormLogin() {
  const router = useRouter()
  const supabase = createClientBrowser() 
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 3. Configuramos React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  // 4. Esta función se llama al enviar el formulario
  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setAuthError(null) // Reseteamos el error

    // 5. Usamos el cliente de Supabase para el login
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    setLoading(false)

    if (error) {
      setAuthError(error.message) 
    } else {
      // Redirigimos al dashboard (o a la home)
      router.refresh()
      router.push('/dashboard')
    }
  }

  return (
    <>  

        {/* 7. El formulario llama a handleSubmit(onSubmit) */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 "
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')} // Conectamos el input
              className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ringmain focus:bordermain"
            />
            {errors.email && (
              <p className="mt-2 text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 "
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              {...register('password')} // Conectamos el input
              className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ringmain focus:bordermain"
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
              className="cursor-pointer w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-main hover:bg-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ringmain disabled:bg-zinc-400"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>
    </>
  )
}