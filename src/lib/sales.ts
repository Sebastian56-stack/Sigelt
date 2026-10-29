import { supabase } from "@/lib/supabase";

// Producto que se enviará desde el carrito.
export type SaleCartItem = {
  productId: string;
  quantity: number;
};

// Confirma una venta en Supabase.
// Retorna el identificador de la venta registrada.
export async function confirmSale(
  inventoryId: string,
  requestId: string,
  items: SaleCartItem[],
): Promise<string> {
  if (!inventoryId || !requestId) {
    throw new Error("Falta información de la venta.");
  }

  if (items.length === 0) {
    throw new Error("El carrito está vacío.");
  }

  if (items.length > 500) {
    throw new Error("El carrito tiene demasiados productos.");
  }

  const ids = new Set<string>();

  for (const item of items) {
    if (
      !item.productId ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 1000000
    ) {
      throw new Error("Hay productos o cantidades inválidas.");
    }

    if (ids.has(item.productId)) {
      throw new Error("Hay productos repetidos en el carrito.");
    }

    ids.add(item.productId);
  }

  // Enviar la venta a la función de PostgreSQL.
  const { data, error } = await supabase.rpc("confirm_sale", {
    p_inventory_id: inventoryId,
    p_request_id: requestId,
    p_items: items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
  });

  if (error) {
    console.error("Error al registrar venta:", error);
    throw new Error(error.message);
  }

  if (typeof data !== "string" || !data) {
    throw new Error("No se recibió el identificador de la venta.");
  }

  return data;
}
