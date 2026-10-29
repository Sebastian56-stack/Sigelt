import { supabase } from "@/lib/supabase";

export type Inventory = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

// Obtener el inventario del usuario autenticado.
// RLS determina qué registros puede consultar.

export async function getMyInventory(): Promise<Inventory | null> {
  const { data, error } = await supabase
    .from("inventories")
    .select("id, owner_id, name, created_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Inventory | null;
}

// Crear inventario.
// owner_id se asigna en PostgreSQL con auth.uid().
// No confiamos en un identificador enviado por el cliente.

export async function createMyInventory(name: string): Promise<Inventory> {
  const cleanName = name.trim();

  const { data, error } = await supabase
    .from("inventories")
    .insert({
      name: cleanName,
    })
    .select("id, owner_id, name, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as Inventory;
}
