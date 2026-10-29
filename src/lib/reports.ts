import { supabase } from "@/lib/supabase";

export type SoldProduct = {
  product_id: string;
  name: string;
  code: string;
  unit: string;
  current_status: "active" | "archived";
  quantity_sold: number;
  sales_amount: number;
};

export type ProductWithoutSales = {
  product_id: string;
  name: string;
  code: string;
  unit: string;
  created_at: string;
  created_during_period: boolean;
};

export type StockAlert = {
  product_id: string;
  name: string;
  code: string;
  unit: string;
  stock_quantity: number;
  min_stock: number;
  alert_type: "out_of_stock" | "low_stock";
};

export type MonthlyReport = {
  schema_version: 1;
  generated_at: string;
  currency: "COP";
  timezone: "America/Bogota";

  inventory: {
    id: string;
    name: string;
    created_at: string;
  };

  period: {
    month: string;
    start_at: string;
    end_exclusive: string;
    cutoff_exclusive: string;
    is_current_month: boolean;
    inventory_created_during_month: boolean;
    before_inventory_creation: boolean;
  };

  summary: {
    sales_total: number;
    sales_count: number;
    average_sale: number | null;
    distinct_products_sold: number;
  };

  products_sold: SoldProduct[];
  products_without_sales: ProductWithoutSales[];

  current_stock: {
    as_of: string;
    out_of_stock_count: number;
    low_stock_count: number;
    alerts: StockAlert[];
  };
};

// Recibe un mes en formato YYYY-MM, por ejemplo: "2026-10".
export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith("0000-")) {
    throw new Error("Selecciona un mes válido.");
  }

  // Supabase envía la sesión del usuario automáticamente.
  // La función SQL comprueba quién es y consulta su inventario.
  const { data, error } = await supabase.rpc("get_monthly_report", {
    p_month: `${month}-01`,
  });

  if (error) {
    throw new Error(error.message || "No pudimos consultar el informe.");
  }

  // Comprobación básica del formato de respuesta.
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.schema_version !== 1 ||
    !data.summary ||
    !Array.isArray(data.products_sold) ||
    !Array.isArray(data.products_without_sales) ||
    !data.current_stock ||
    !Array.isArray(data.current_stock.alerts)
  ) {
    throw new Error("El informe recibido tiene un formato inesperado.");
  }

  return data as MonthlyReport;
}
