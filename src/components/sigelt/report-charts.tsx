import { Copy, colors } from "@/components/sigelt/primitives";
import type { DailySale, VisualMonthlyReport } from "@/lib/visual-reports";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("es-CO");

const percent = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1,
});

const amber = "#f3c77b";
const red = "#ffb4ab";

function dayLabel(day: DailySale) {
  const date = day.date.split("-").reverse().join("/");

  if (day.coverage === "not_elapsed") {
    return date + " · Día aún no transcurrido.";
  }

  if (day.coverage === "before_inventory") {
    return date + " · El inventario aún no existía.";
  }

  return (
    date +
    " · " +
    money.format(day.sales_total!) +
    " COP · " +
    number.format(day.sales_count!) +
    " ventas confirmadas" +
    (day.coverage === "partial"
      ? " · Día con cobertura parcial."
      : " · Día completo.")
  );
}

function DailyChart({ days }: { days: DailySale[] }) {
  const [selected, setSelected] = useState("");

  const observed = days.filter((day) => day.sales_total !== null);

  const detail =
    days.find((day) => day.date === selected) ??
    observed[observed.length - 1] ??
    days[0];

  const maximum = Math.max(0, ...days.map((day) => day.sales_total ?? 0));

  return (
    <View style={s.card}>
      <Copy accessibilityRole="header" style={s.title}>
        Ventas por día
      </Copy>

      <Copy style={s.note}>
        Importes en COP. Desliza horizontalmente y pulsa un día para ver sus
        cifras.
      </Copy>

      <View style={s.chartRow}>
        <View style={s.axis}>
          <Copy style={s.axisText}>{compactMoney.format(maximum)}</Copy>

          <Copy style={s.axisText}>{compactMoney.format(maximum / 2)}</Copy>

          <Copy style={s.axisText}>$0</Copy>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={s.scroller}
          contentContainerStyle={s.plot}
        >
          {days.map((day) => {
            const selectedDay = day.date === detail?.date;
            const value = day.sales_total;

            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(day)}
                accessibilityState={{ selected: selectedDay }}
                onPress={() => setSelected(day.date)}
                style={({ pressed }) => [
                  s.day,
                  selectedDay && s.selected,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={s.track}>
                  {value === null ? (
                    <Copy style={s.note}>—</Copy>
                  ) : (
                    <View
                      style={{
                        width: 24,
                        height: maximum > 0 ? (160 * value) / maximum : 0,
                        backgroundColor:
                          day.coverage === "partial" ? amber : colors.mint,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }}
                    />
                  )}
                </View>

                <Copy style={[s.note, selectedDay && { color: colors.mint }]}>
                  {day.date.slice(-2)}
                </Copy>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Copy style={s.note}>
        Verde: día completo · Ámbar: día parcial · —: sin observación. Los días
        observados sin importe vendido tienen valor $0.
      </Copy>

      {detail && (
        <View style={s.detail} accessibilityLiveRegion="polite">
          <Copy style={s.detailText}>{dayLabel(detail)}</Copy>
        </View>
      )}
    </View>
  );
}

export function ReportCharts({ report }: { report: VisualMonthlyReport }) {
  const ranking = [...report.products_sold]
    .sort(
      (a, b) => b.sales_amount - a.sales_amount || a.code.localeCompare(b.code),
    )
    .slice(0, 5);

  const stock = report.charts.stock_distribution;

  const groups = [
    {
      label: "Agotados",
      value: stock.out_of_stock,
      color: red,
    },
    {
      label: "En el mínimo o por debajo",
      value: stock.low_stock,
      color: amber,
    },
    {
      label: "Por encima del mínimo",
      value: stock.above_minimum,
      color: colors.mint,
    },
  ];

  const asOf = new Intl.DateTimeFormat("es-CO", {
    timeZone: report.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(stock.as_of));

  return (
    <View style={s.wrapper}>
      <DailyChart key={report.generated_at} days={report.charts.daily_sales} />

      <View style={s.columns}>
        <View style={[s.card, s.column]}>
          <Copy accessibilityRole="header" style={s.title}>
            Productos que más aportan
          </Copy>

          <Copy style={s.note}>
            Hasta 5 productos, ordenados por importe vendido. Cada barra
            representa su participación en las ventas del mes.
          </Copy>

          {ranking.length === 0 ? (
            <Copy style={s.empty}>
              No hay ventas para construir esta gráfica.
            </Copy>
          ) : (
            ranking.map((product, index) => {
              const share =
                report.summary.sales_total > 0
                  ? product.sales_amount / report.summary.sales_total
                  : 0;

              return (
                <View key={product.product_id} style={s.rankingItem}>
                  <View style={s.row}>
                    <Copy style={s.product}>
                      {index + 1}. {product.name}
                      {product.current_status === "archived"
                        ? " · Archivado"
                        : ""}
                    </Copy>

                    <Copy style={s.amount}>
                      {money.format(product.sales_amount)}
                    </Copy>
                  </View>

                  <View style={s.barBackground}>
                    <View
                      style={[
                        s.barFill,
                        {
                          width: `${Math.min(100, share * 100)}%`,
                        },
                      ]}
                    />
                  </View>

                  <Copy style={s.note}>
                    {product.code} · {number.format(product.quantity_sold)}{" "}
                    {product.unit} ·{" "}
                    {report.summary.sales_total > 0
                      ? percent.format(share) + " del total"
                      : "Sin participación calculable"}
                  </Copy>
                </View>
              );
            })
          )}

          {report.products_sold.length > 5 && (
            <Copy style={s.note}>
              Mostrando 5 de {number.format(report.products_sold.length)}{" "}
              productos. El detalle completo aparece debajo.
            </Copy>
          )}
        </View>

        <View style={[s.card, s.column]}>
          <Copy accessibilityRole="header" style={s.title}>
            Estado del inventario · Ahora
          </Copy>

          <Copy style={s.note}>
            Referencias activas del catálogo. Este estado es actual, aunque
            selecciones un mes anterior.
          </Copy>

          <Copy style={s.total}>{number.format(stock.active_products)}</Copy>

          <Copy style={s.note}>
            productos activos · cajas y unidades no se suman
          </Copy>

          {stock.active_products === 0 ? (
            <Copy style={s.empty}>Aún no hay productos activos.</Copy>
          ) : (
            <>
              <View style={s.stockBar}>
                {groups
                  .filter((group) => group.value > 0)
                  .map((group) => (
                    <View
                      key={group.label}
                      style={{
                        flex: group.value,
                        backgroundColor: group.color,
                      }}
                    />
                  ))}
              </View>

              {groups.map((group) => (
                <View key={group.label} style={s.stockRow}>
                  <View style={[s.dot, { backgroundColor: group.color }]} />

                  <Copy style={s.product}>{group.label}</Copy>

                  <Copy style={s.amount}>
                    {number.format(group.value)} ·{" "}
                    {percent.format(group.value / stock.active_products)}
                  </Copy>
                </View>
              ))}
            </>
          )}

          <Copy style={s.note}>Consultado: {asOf} · Colombia</Copy>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    gap: 16,
  },
  card: {
    padding: 20,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
  },
  note: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
  },
  chartRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  axis: {
    width: 64,
    height: 176,
    justifyContent: "space-between",
    paddingRight: 6,
  },
  axisText: {
    fontSize: 10,
    lineHeight: 16,
    color: colors.muted,
  },
  scroller: {
    flex: 1,
    minWidth: 0,
    height: 216,
  },
  plot: {
    paddingBottom: 12,
    alignItems: "flex-start",
  },
  day: {
    width: 44,
    padding: 6,
    alignItems: "center",
    borderRadius: 8,
    gap: 6,
  },
  selected: {
    backgroundColor: "#223427",
  },
  track: {
    height: 160,
    width: 30,
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  detail: {
    padding: 12,
    backgroundColor: colors.elevated,
    borderRadius: 10,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 22,
  },
  columns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  column: {
    flexBasis: 320,
    flexGrow: 1,
    flexShrink: 1,
  },
  rankingItem: {
    gap: 6,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  product: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 22,
  },
  amount: {
    color: colors.mint,
    fontSize: 13,
    lineHeight: 22,
    flexShrink: 1,
  },
  barBackground: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.mint,
    borderRadius: 5,
  },
  total: {
    fontSize: 38,
    lineHeight: 46,
    fontWeight: "600",
    color: colors.mint,
  },
  stockBar: {
    height: 22,
    flexDirection: "row",
    borderRadius: 7,
    overflow: "hidden",
    marginVertical: 12,
  },
  stockRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  empty: {
    paddingVertical: 20,
    fontSize: 13,
    lineHeight: 22,
    color: colors.muted,
  },
});
