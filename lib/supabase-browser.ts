import { createBrowserClient } from '@supabase/ssr'

// Este cliente se usa en CUALQUIER componente 'use client'
export function createClientBrowser() {
  // OJO: Estas variables deben estar en .env.local
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}