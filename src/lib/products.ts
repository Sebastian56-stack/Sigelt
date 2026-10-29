import { supabase } from "@/lib/supabase";

export type Product = {
  id: string;
  inventory_id: string;
  name: string;
  code: string;
  category: string;
  description: string | null;
  unit: string;
  sale_price: number;
  min_stock: number;
  stock_quantity: number;
  status: "active" | "archived";
  created_at: string;
};

export type NewProduct = {
  name: string;
  code: string;
  category: string;
  description: string;
  unit: string;
  sale_price: number;
  min_stock: number;
};

const PRODUCT_COLUMNS =
  "id, inventory_id, name, code, category, description, unit, sale_price, min_stock, stock_quantity, status, created_at";

export async function getProducts(inventoryId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("inventory_id", inventoryId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function createProduct(
  inventoryId: string,
  input: NewProduct,
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      inventory_id: inventoryId,
      name: input.name.trim(),
      code: input.code.trim(),
      category: input.category.trim(),
      description: input.description.trim() || null,
      unit: input.unit.trim(),
      sale_price: input.sale_price,
      min_stock: input.min_stock,
      status: "active",
      // No enviar stock_quantity: PostgreSQL lo inicia en 0.
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as Product;
}

export async function updateProduct(
  productId: string,
  input: NewProduct,
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      code: input.code.trim(),
      category: input.category.trim(),
      description: input.description.trim() || null,
      unit: input.unit.trim(),
      sale_price: input.sale_price,
      min_stock: input.min_stock,
    })
    .eq("id", productId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw error;

  return data as unknown as Product;
}

export async function registerStockEntry(
  productId: string,
  quantity: number,
  note: string,
): Promise<number> {
  // La función de PostgreSQL comprueba propietario, bloquea la fila,
  // actualiza el stock y registra el movimiento en una transacción.
  const { data, error } = await supabase.rpc("register_stock_entry", {
    p_product_id: productId,
    p_quantity: quantity,
    p_note: note.trim() || null,
  });

  if (error) throw error;
  return Number(data);
}

export type StockMovement = {
  id: string;
  inventory_id: string;
  product_id: string;
  movement_type: "entry" | "adjustment" | "sale" | "sale_reversal";
  quantity_change: number;
  stock_after: number;
  note: string | null;
  created_at: string;
};

export async function getStockMovements(
  inventoryId: string,
): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      "id, inventory_id, product_id, movement_type, quantity_change, stock_after, note, created_at",
    )
    .eq("inventory_id", inventoryId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as StockMovement[];
}
