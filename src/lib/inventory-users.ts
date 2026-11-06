import { supabase } from "@/lib/supabase";

export type InventoryRole = "admin" | "user";
export type ActiveInventoryAccess = {
  state: "active";
  role: InventoryRole;
  inventory_id: string;
  inventory_name: string;
};
export type InventoryAccess = ActiveInventoryAccess | {
  state: "pending" | "suspended";
  role: InventoryRole | null;
  inventory_id: null;
  inventory_name: null;
};
export type InventoryMember = {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: InventoryRole;
  access_status: "active" | "suspended";
  created_at: string;
};

export async function getMyInventoryAccess(signal?: AbortSignal): Promise<InventoryAccess> {
  const request = supabase.rpc("get_my_inventory_access");
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw error;
  if (data?.state === "active" && (data.role === "admin" || data.role === "user") &&
      typeof data.inventory_id === "string" && typeof data.inventory_name === "string") {
    return data as ActiveInventoryAccess;
  }
  if (data?.state === "pending" || data?.state === "suspended") {
    return { state: data.state, role: data.role === "admin" || data.role === "user" ? data.role : null,
      inventory_id: null, inventory_name: null };
  }
  throw new Error("No se pudo comprobar el acceso al inventario.");
}

export async function listInventoryUsers(): Promise<InventoryMember[]> {
  // Supabase pagina las respuestas. Recuperar todas evita omitir miembros silenciosamente.
  const rows: InventoryMember[] = [];
  const size = 100;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabase.rpc("list_inventory_users").range(offset, offset + size - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("No se pudo leer la lista de usuarios.");
    rows.push(...(data as InventoryMember[]));
    if (data.length < size) return rows;
  }
}

export async function addInventoryUser(email: string): Promise<{ already_member: boolean }> {
  const { data, error } = await supabase.rpc("add_inventory_user", { p_email: email.trim().toLowerCase() });
  if (error) throw error;
  if (typeof data?.already_member !== "boolean") throw new Error("Revisa la lista para comprobar el resultado.");
  return data;
}

export async function setInventoryUserStatus(userId: string, status: "active" | "suspended"): Promise<void> {
  const { error } = await supabase.rpc("set_inventory_user_status", { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export function inventoryAccessError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  // Los mensajes de validacion provienen de las funciones del bloque 11.
  if (code === "22023" || code === "42501") return message || "No tienes permiso para realizar esta operación.";
  if (code === "PGRST202" || code === "42883") return "Falta actualizar las operaciones de usuarios en Supabase (bloque 11).";
  return "No pudimos completar la solicitud. Revisa tu conexión y vuelve a intentarlo.";
}
