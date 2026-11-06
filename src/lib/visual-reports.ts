import type { MonthlyReport } from "@/lib/reports";
import { supabase } from "@/lib/supabase";

export type DailySale = {
  date: string;
  coverage: "complete" | "partial" | "before_inventory" | "not_elapsed";
  sales_count: number | null;
  sales_total: number | null;
};

export type VisualMonthlyReport = MonthlyReport & {
  charts: {
    version: 1;
    daily_sales: DailySale[];
    stock_distribution: {
      as_of: string;
      active_products: number;
      out_of_stock: number;
      low_stock: number;
      above_minimum: number;
    };
  };
};

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const count = (value: unknown): value is number =>
  positive(value) && Number.isSafeInteger(value);

export function validateVisualReport(
  value: unknown,
  month: string,
): VisualMonthlyReport {
  const r = value as VisualMonthlyReport | null;

  const fail = () => {
    throw new Error(
      "El informe visual tiene datos incompatibles. Revisa el bloque 15A.",
    );
  };

  if (
    !r ||
    r.schema_version !== 1 ||
    r.currency !== "COP" ||
    r.timezone !== "America/Bogota" ||
    !r.inventory?.id ||
    !r.period?.month?.startsWith(month) ||
    !Number.isFinite(Date.parse(r.generated_at)) ||
    !positive(r.summary?.sales_total) ||
    !count(r.summary?.sales_count) ||
    !count(r.summary?.distinct_products_sold) ||
    !(r.summary.average_sale === null || positive(r.summary.average_sale)) ||
    !Array.isArray(r.products_sold) ||
    !Array.isArray(r.products_without_sales) ||
    !Array.isArray(r.current_stock?.alerts) ||
    r.charts?.version !== 1 ||
    !Array.isArray(r.charts.daily_sales)
  ) {
    return fail();
  }

  const [year, m] = month.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    m - 1
  ];

  let amount = 0;
  let sales = 0;

  if (r.charts.daily_sales.length !== days) return fail();

  r.charts.daily_sales.forEach((day, index) => {
    const expectedDate = month + "-" + String(index + 1).padStart(2, "0");

    if (!day || day.date !== expectedDate) return fail();

    if (day.coverage === "before_inventory" || day.coverage === "not_elapsed") {
      if (day.sales_count !== null || day.sales_total !== null) {
        return fail();
      }
    } else {
      if (
        !["complete", "partial"].includes(day.coverage) ||
        !count(day.sales_count) ||
        !positive(day.sales_total)
      ) {
        return fail();
      }

      sales += day.sales_count;
      amount += day.sales_total;
    }
  });

  const stock = r.charts.stock_distribution;

  if (
    !stock ||
    !Number.isFinite(Date.parse(stock.as_of)) ||
    ![
      stock.active_products,
      stock.out_of_stock,
      stock.low_stock,
      stock.above_minimum,
    ].every(count) ||
    stock.active_products !==
      stock.out_of_stock + stock.low_stock + stock.above_minimum ||
    stock.out_of_stock !== r.current_stock.out_of_stock_count ||
    stock.low_stock !== r.current_stock.low_stock_count ||
    stock.as_of !== r.current_stock.as_of ||
    sales !== r.summary.sales_count ||
    Math.abs(amount - r.summary.sales_total) >
      Math.max(0.01, Math.abs(amount) * Number.EPSILON * days * 2) ||
    !r.products_sold.every(
      (p) =>
        p &&
        typeof p.name === "string" &&
        typeof p.code === "string" &&
        typeof p.unit === "string" &&
        positive(p.sales_amount) &&
        count(p.quantity_sold),
    )
  ) {
    return fail();
  }

  return r;
}

export async function getVisualMonthlyReport(
  month: string,
  signal?: AbortSignal,
): Promise<VisualMonthlyReport> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith("0000")) {
    throw new Error("Selecciona un mes válido.");
  }

  const query = supabase.rpc("get_monthly_report_visual", {
    p_month: month + "-01",
  });

  const { data, error } = await (signal ? query.abortSignal(signal) : query);

  if (error) {
    throw new Error(error.message || "No pudimos consultar el informe visual.");
  }

  return validateVisualReport(data, month);
}
