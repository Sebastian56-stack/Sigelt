import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createForecastDemo } from "../../lib/forecast-demo";
import { forecastProduct, MODEL_LABELS } from "../../lib/forecast-engine";
import { colors, Copy } from "./primitives";
import { ReplenishmentSimulator } from "./replenishment-simulator";

const demo = createForecastDemo();

const number = (value: number) =>
  value.toLocaleString("es-CO", {
    maximumFractionDigits: 2,
  });

const date = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

type Bar = {
  date: string;
  quantity: number | null;
  kind: "recorded" | "forecast" | "stockout" | "missing";
};

function Bars({ rows, unit }: { rows: Bar[]; unit: string }) {
  const maximum = Math.max(1, ...rows.map((row) => row.quantity ?? 0));

  return (
    <View style={{ gap: 14 }}>
      {rows.map((row) => {
        const forecast = row.kind === "forecast";

        const label =
          row.kind === "missing"
            ? "Sin registro"
            : row.kind === "stockout"
              ? "Venta con disponibilidad limitada"
              : forecast
                ? "Previsto"
                : "Registrado";

        return (
          <View key={row.date} style={{ gap: 5 }}>
            <View style={styles.line}>
              <Copy style={styles.small}>
                {date(row.date)} · {label}
              </Copy>

              <Copy
                style={{
                  color: forecast ? colors.mint : colors.text,
                }}
              >
                {row.quantity === null ? "—" : number(row.quantity)} {unit}
              </Copy>
            </View>

            <View style={styles.track} accessible={false}>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  width: `${(100 * (row.quantity ?? 0)) / maximum}%`,
                  backgroundColor: forecast ? colors.mint : "#738c7c",
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Copy style={styles.small}>{label}</Copy>
      <Copy style={styles.value}>{value}</Copy>
    </View>
  );
}

export function InventoryIntelligencePanel() {
  const [selectedId, setSelectedId] = useState(demo.products[0].id);

  const selected = demo.products.find((product) => product.id === selectedId)!;

  const calculation = useMemo(() => {
    try {
      return {
        result: forecastProduct(selected, demo.source),
        error: "",
      };
    } catch {
      return {
        result: null,
        error:
          "No se pudo analizar el historial. Revisa sus fechas y cantidades.",
      };
    }
  }, [selected]);

  const result = calculation.result;

  const rows: Bar[] = selected.days.slice(-7).map((day) => ({
    date: day.date,
    quantity: day.quantity,
    kind: day.observation,
  }));

  if (result?.status === "ready") {
    rows.push(
      ...result.points.map((point) => ({
        ...point,
        kind: "forecast" as const,
      })),
    );
  }

  return (
    <View style={styles.page}>
      <Copy accessibilityRole="header" headingLevel={1} style={styles.title}>
        Inteligencia de inventario
      </Copy>

      <Copy style={styles.muted}>
        Explora las ventas previstas y comprueba cómo se comporta cada
        pronóstico.
      </Copy>

      <View style={styles.notice}>
        <Copy
          style={{
            color: colors.mint,
            fontWeight: "700",
          }}
        >
          Simulación · Datos sintéticos
        </Copy>

        <Copy style={styles.small}>
          Historial de evaluación: {date(demo.startDate)} a {date(demo.endDate)}
          . Estos productos son escenarios de prueba independientes de tu
          inventario.
        </Copy>
      </View>

      <Copy accessibilityRole="header">Selecciona un producto</Copy>

      <View style={styles.choices}>
        {demo.products.map((product) => {
          const active = product.id === selectedId;

          return (
            <Pressable
              key={product.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedId(product.id)}
              style={({ pressed }) => [
                styles.choice,
                active && styles.selected,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Copy
                style={{
                  color: active ? colors.mint : colors.text,
                }}
              >
                {product.name}
              </Copy>
            </Pressable>
          );
        })}
      </View>

      {!!calculation.error && (
        <View style={styles.notice}>
          <Copy accessibilityRole="alert">{calculation.error}</Copy>
        </View>
      )}

      {result?.status === "ready" && (
        <ReplenishmentSimulator key={result.productId} forecast={result} />
      )}

      {result?.status === "ready" && (
        <>
          <View style={styles.choices}>
            <Metric
              label="Ventas previstas · 7 días"
              value={`${number(result.total)} ${result.unit}`}
            />

            <Metric
              label="Error semanal observado"
              value={`${number(result.evaluation.weeklyMae)} ${result.unit}`}
            />
          </View>

          <View style={styles.card}>
            <Copy accessibilityRole="header">{MODEL_LABELS[result.model]}</Copy>

            <Copy style={styles.muted}>
              Proyección del {date(result.points[0].date)} al{" "}
              {date(result.points[6].date)}. Calculada con registros hasta el{" "}
              {date(result.asOf)}.
            </Copy>

            <Copy style={styles.small}>
              Las cantidades son estimaciones y pueden tener decimales. No
              equivalen a una orden de compra.
            </Copy>
          </View>
        </>
      )}

      <View style={styles.card}>
        <Copy accessibilityRole="header">
          {result?.status === "ready"
            ? "Historial y próximos siete días"
            : "Últimos registros"}
        </Copy>

        <Copy style={styles.small}>
          Cantidades en {selected.unit}. Las barras parten de cero y comparten
          escala. Verde: previsto. Gris: registrado.
        </Copy>

        <Bars rows={rows} unit={selected.unit} />
      </View>

      {result?.status === "ready" && (
        <View style={styles.card}>
          <Copy accessibilityRole="header">¿Cómo rindió el método?</Copy>

          <Copy style={styles.muted}>
            Evaluado en {result.evaluation.weeks} semanas posteriores a las
            utilizadas para seleccionarlo. Menor error significa mejor
            resultado.
          </Copy>

          <Copy>
            Error semanal del método: {number(result.evaluation.weeklyMae)}{" "}
            {result.unit}.
          </Copy>

          <Copy>
            Error semanal del promedio de referencia:{" "}
            {number(result.baselineEvaluation.weeklyMae)} {result.unit}.
          </Copy>

          <Copy
            style={
              result.evaluation.weeklyMae > result.baselineEvaluation.weeklyMae
                ? styles.warning
                : styles.muted
            }
          >
            {result.improvementPercent === null
              ? "La referencia tuvo error cero. No calculamos una mejora porcentual."
              : result.improvementPercent < 0
                ? `El error fue ${number(
                    -result.improvementPercent,
                  )}% mayor que el de referencia. Conviene revisar este método antes de usarlo para decidir.`
                : result.improvementPercent === 0
                  ? "El error fue igual al del promedio de referencia."
                  : `El error fue ${number(
                      result.improvementPercent,
                    )}% menor que el de referencia en estas semanas.`}
          </Copy>

          <Copy style={styles.small}>
            Esta comparación no es un porcentaje de precisión ni garantiza
            resultados futuros.
          </Copy>

          <Copy accessibilityRole="header">Comparación usada para elegir</Copy>

          {result.validation.map((item) => (
            <View key={item.model} style={styles.line}>
              <Copy style={styles.small}>{MODEL_LABELS[item.model]}</Copy>

              <Copy>
                {number(item.metrics.weeklyMae)} {result.unit}
              </Copy>
            </View>
          ))}

          <Copy style={styles.small}>
            Error absoluto medio del total semanal en las cuatro semanas de
            selección. Los errores se comparan dentro del mismo producto.
          </Copy>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 1050,
    alignSelf: "center",
    gap: 18,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "700",
  },
  muted: {
    color: colors.muted,
  },
  small: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  notice: {
    padding: 18,
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#1d2b1e",
  },
  card: {
    padding: 20,
    gap: 15,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choice: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: "#203323",
    borderColor: colors.mint,
  },
  metric: {
    flexGrow: 1,
    flexBasis: 220,
    padding: 20,
    gap: 10,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.mint,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  warning: {
    color: "#f2c879",
  },
});
