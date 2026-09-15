"use server";

import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { createClientServer } from "@/lib/supabase";

const supabaseAdmin = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { cookies: { getAll: () => [], setAll: () => {} } }
);

// --- AUTORIZACIÓN ---
// Verifica el rol contra la sesión del servidor (nunca contra un valor
// enviado por el cliente/formulario) antes de permitir el uso de
// supabaseAdmin, que bypassea RLS.
async function requireAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado" };
  }

  const { data: agent, error } = await supabase
    .from("agents")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || agent?.role !== "admin") {
    return { error: "No autorizado: se requiere rol de administrador" };
  }

  return null;
}

// --- HELPER ---
async function uploadAvatar(file: File) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${uuidv4()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error } = await supabaseAdmin.storage
    .from("avatars")
    .upload(filePath, file);

  if (error) throw new Error("Error subiendo imagen");

  const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);

  return data.publicUrl;
}

// --- CREAR ---
export async function createAgentAction(formData: FormData) {
  const adminError = await requireAdmin();
  if (adminError) return { error: adminError.error };

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const full_name = formData.get("full_name") as string;
  const phone = formData.get("phone") as string;
  const role = formData.get("role") as string;
  const imageFile = formData.get("avatar") as File | null;

  // 1. Subir imagen si existe
  let avatar_url = null;
  if (imageFile && imageFile.size > 0) {
    try {
      avatar_url = await uploadAvatar(imageFile);
    } catch (e) {
      return { error: "Falló la subida de imagen" };
    }
  }

  // 2. Crear Auth User
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

  if (authError) return { error: authError.message };
  if (!authData.user) return { error: "No se pudo crear usuario" };

  // 3. Crear Perfil
  const { error: profileError } = await supabaseAdmin.from("agents").insert({
    id: authData.user.id,
    email,
    full_name,
    phone,
    role,
    avatar_url, 
  });

  if (profileError) return { error: profileError.message };

  revalidatePath("/dashboard/agentes");
  return { success: true };
}

// --- EDITAR  ---
export async function updateAgentAction(formData: FormData) {
  const adminError = await requireAdmin();
  if (adminError) return { error: adminError.error };

  const id = formData.get("id") as string;
  const full_name = formData.get("full_name") as string;
  const phone = formData.get("phone") as string;
  const role = formData.get("role") as string;
  const imageFile = formData.get("avatar") as File | null;

  // 1. Manejo de Imagen
  let updateData: any = { full_name, phone, role };

  if (imageFile && imageFile.size > 0) {
    try {
      const url = await uploadAvatar(imageFile);
      updateData.avatar_url = url;
    } catch (e) {
      return { error: "Error subiendo nueva imagen" };
    }
  }

  // 2. Actualizar Perfil (Agents)
  const { error } = await supabaseAdmin
    .from("agents")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };

  await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: { full_name, role },
  });

  revalidatePath("/dashboard/agentes");
  return { success: true };
}

// --- BORRAR ---
export async function deleteAgentAction(userId: string) {
  const adminError = await requireAdmin();
  if (adminError) return { error: adminError.error };

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/agentes");
  return { success: true };
}
