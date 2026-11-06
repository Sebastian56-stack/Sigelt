import { Copy, colors } from "@/components/sigelt/primitives";
import { ReportCharts } from "@/components/sigelt/report-charts";
import { ReportPdfButton } from "@/components/sigelt/report-pdf-button";
import {
  getVisualMonthlyReport,
  type VisualMonthlyReport,
} from "@/lib/visual-reports";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("es-CO");

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  return (
    parts.find((p) => p.type === "year")!.value +
    "-" +
    parts.find((p) => p.type === "month")!.value
  );
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const total = year * 12 + month - 1 + offset;

  return (
    String(Math.floor(total / 12)).padStart(4, "0") +
    "-" +
    String((total % 12) + 1).padStart(2, "0")
  );
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type Result = {
  key: string;
  report: VisualMonthlyReport | null;
  error: string;
};

export function MonthlyReportPanel({ inventoryId }: { inventoryId: string }) {
  const [month, setMonth] = useState(currentMonth);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const requestKey = inventoryId + ":" + month + ":" + revision;
  const loading = result?.key !== requestKey;
  const report = loading ? null : result?.report;
  const error = loading ? "" : result?.error;
  const [year, monthNumber] = month.split("-").map(Number);

  useEffect(() => {
    let active = true;

    const timeout = setTimeout(() => {
      if (!active) return;

      active = false;

      setResult({
        key: requestKey,
        report: null,
        error:
          "La consulta tardó demasiado. Revisa tu conexión y pulsa Actualizar.",
      });
    }, 30000);

    getVisualMonthlyReport(month)
      .then((data) => {
        if (!active) return;

        if (data.inventory.id !== inventoryId) {
          throw new Error("El informe no corresponde al inventario abierto.");
        }

        setResult({
          key: requestKey,
          report: data,
          error: "",
        });
      })
      .catch((err: unknown) => {
        if (!active) return;

        setResult({
          key: requestKey,
          report: null,
          error:
            err instanceof Error
              ? err.message
              : "No pudimos cargar el informe.",
        });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [inventoryId, month, requestKey]);

  return (
    <View style={s.page}>
      <Copy accessibilityRole="header" headingLevel={1} style={s.title}>
        Informe mensual
      </Copy>

      <Copy style={s.muted}>
        Tus ventas y productos, con cifras para decidir.
      </Copy>

      <View style={s.toolbar}>
        <Button
          label="Mes anterior"
          disabled={month <= "0001-01"}
          onPress={() => setMonth(shiftMonth(month, -1))}
        />

        <Copy style={s.month}>
          {months[monthNumber - 1]} {year}
        </Copy>

        <Button
          label="Mes siguiente"
          disabled={month >= currentMonth()}
          onPress={() => setMonth(shiftMonth(month, 1))}
        />

        <Button
          label="Actualizar"
          disabled={loading}
          onPress={() => setRevision((value) => value + 1)}
        />
      </View>

      {loading && (
        <View style={s.message} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.mint} />
          <Copy style={s.muted}>Consultando el informe…</Copy>
        </View>
      )}

      {error ? (
        <View style={s.card}>
          <Copy accessibilityRole="alert" style={{ color: "#ffb4ab" }}>
            {error}
          </Copy>

          <Copy style={s.muted}>
            Puedes volver a intentarlo con Actualizar.
          </Copy>
        </View>
      ) : null}

      {report && (
        <>
          <ReportPdfButton key={requestKey} report={report} />

          <Copy style={s.note}>
            {report.period.is_current_month
              ? "Mes en curso · "
              : "Mes cerrado · "}
            Ventas confirmadas · Horario de Colombia
          </Copy>

          {report.period.before_inventory_creation ? (
            <Copy style={s.notice}>
              Tu inventario aún no existía durante este mes.
            </Copy>
          ) : report.period.inventory_created_during_month ? (
            <Copy style={s.notice}>
              El inventario se creó durante este mes: el período no tiene
              cobertura completa.
            </Copy>
          ) : null}

          <View style={s.metrics}>
            {[
              ["Total vendido", money.format(report.summary.sales_total)],
              ["Ventas confirmadas", number.format(report.summary.sales_count)],
              [
                "Promedio por venta",
                report.summary.average_sale === null
                  ? "Sin datos"
                  : money.format(report.summary.average_sale),
              ],
              [
                "Productos distintos vendidos",
                number.format(report.summary.distinct_products_sold),
              ],
            ].map(([label, value]) => (
              <View key={label} style={s.metric}>
                <Copy style={s.note}>{label}</Copy>
                <Copy style={s.value}>{value}</Copy>
              </View>
            ))}
          </View>

          <ReportCharts report={report} />

          <List
            title="Productos vendidos"
            caption="Ordenados de mayor a menor importe vendido. Importes al precio de cada venta; nombres y unidades del catálogo actual."
            empty="No hay productos vendidos en este período."
            rows={[...report.products_sold]
              .sort(
                (a, b) =>
                  b.sales_amount - a.sales_amount ||
                  a.code.localeCompare(b.code),
              )
              .map((p) => ({
                id: p.product_id,
                title:
                  p.name +
                  (p.current_status === "archived" ? " · Archivado" : ""),
                detail:
                  p.code +
                  " · " +
                  number.format(p.quantity_sold) +
                  " " +
                  p.unit,
                value: money.format(p.sales_amount),
              }))}
          />

          <List
            title="Productos sin ventas"
            caption="Productos actualmente activos, creados antes del corte y sin ventas confirmadas durante el período."
            empty="No hay productos que cumplan estas condiciones."
            rows={report.products_without_sales.map((p) => ({
              id: p.product_id,
              title: p.name,
              detail:
                p.code +
                (p.created_during_period ? " · Creado durante el período" : ""),
              value: "0 ventas",
            }))}
          />

          <List
            title="Existencias por revisar · Ahora"
            caption={
              "Estado actual, independiente del mes elegido. " +
              report.current_stock.out_of_stock_count +
              " agotados · " +
              report.current_stock.low_stock_count +
              " con existencias bajas. Consultado: " +
              timestamp(report.current_stock.as_of)
            }
            empty="Ningún producto activo está agotado o por debajo de su mínimo, incluyendo el límite."
            rows={report.current_stock.alerts.map((p) => ({
              id: p.product_id,
              title: p.name,
              detail:
                p.code +
                " · Disponible: " +
                number.format(p.stock_quantity) +
                " " +
                p.unit +
                " · Mínimo: " +
                number.format(p.min_stock),
              value:
                p.alert_type === "out_of_stock"
                  ? "Agotado"
                  : "Existencias bajas",
            }))}
          />

          <Copy style={s.note}>
            Informe consultado: {timestamp(report.generated_at)}. Los importes
            representan ventas, no ganancias.
          </Copy>
        </>
      )}
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.button,
        (disabled || pressed) && { opacity: 0.45 },
      ]}
    >
      <Copy style={{ fontSize: 13, color: colors.mint }}>{label}</Copy>
    </Pressable>
  );
}

function List({
  title,
  caption,
  empty,
  rows,
}: {
  title: string;
  caption: string;
  empty: string;
  rows: {
    id: string;
    title: string;
    detail: string;
    value: string;
  }[];
}) {
  return (
    <View style={s.card}>
      <Copy accessibilityRole="header" style={s.sectionTitle}>
        {title}
      </Copy>

      <Copy style={s.note}>{caption}</Copy>

      {rows.length === 0 ? (
        <Copy style={s.empty}>{empty}</Copy>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={s.row}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Copy style={{ fontSize: 14 }}>{row.title}</Copy>
              <Copy style={s.note}>{row.detail}</Copy>
            </View>

            <Copy style={s.rowValue}>{row.value}</Copy>
          </View>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    gap: 16,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "600",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginVertical: 10,
  },
  month: {
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 8,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
  },
  message: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 14,
  },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 22,
    gap: 10,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    flexGrow: 1,
    flexBasis: 200,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 10,
    backgroundColor: colors.panel,
  },
  value: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "600",
    color: colors.mint,
  },
  note: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
  },
  notice: {
    fontSize: 13,
    color: colors.mint,
    backgroundColor: "#1c2b1d",
    padding: 14,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  rowValue: {
    color: colors.mint,
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
  },
  empty: {
    fontSize: 14,
    color: colors.muted,
    paddingVertical: 24,
    textAlign: "center",
  },
});
