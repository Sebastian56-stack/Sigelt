import { buildForecastAdvisorContext } from "@/lib/forecast-advisor-context";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import type { ProductForecast } from "../../lib/forecast-engine";
import { ForecastAdvisor } from "./forecast-advisor";
import { colors, Copy } from "./primitives";

type ReadyForecast = Extract<ProductForecast, { status: "ready" }>;

const format = (value: number) =>
  value.toLocaleString("es-CO", { maximumFractionDigits: 2 });

function readInteger(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;

  const value = Number(text);

  return Number.isSafeInteger(value) && value <= 1000000 ? value : null;
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Copy style={styles.small}>{label}</Copy>

      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={7}
        placeholder="0"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

export function ReplenishmentSimulator({
  forecast,
}: {
  forecast: ReadyForecast;
}) {
  // Son supuestos editables, no existencias obtenidas de Supabase.
  const [stockText, setStockText] = useState("20");
  const [leadText, setLeadText] = useState("2");
  const [reserveText, setReserveText] = useState("5");

  const stock = readInteger(stockText);
  const lead = readInteger(leadText);
  const reserve = readInteger(reserveText);

  const valid =
    stock !== null &&
    lead !== null &&
    reserve !== null &&
    lead <= 6 &&
    forecast.points.length === 7 &&
    forecast.points.every(
      (point) => Number.isFinite(point.quantity) && point.quantity >= 0,
    );

  const simulation = (() => {
    if (!valid || stock === null || lead === null || reserve === null) {
      return null;
    }

    // "2 días" significa dos días completos sin recibir el pedido.
    // La entrega ocurre al inicio del tercer día pronosticado.
    const beforeArrival = forecast.points
      .slice(0, lead)
      .reduce((sum, point) => sum + point.quantity, 0);

    const afterArrival = forecast.points
      .slice(lead)
      .reduce((sum, point) => sum + point.quantity, 0);

    const availableAtArrival = Math.max(0, stock - beforeArrival);

    const uncoveredBeforeArrival = Math.max(0, beforeArrival - stock);

    // Redondeo hacia arriba a una unidad completa del producto:
    // una caja, una resma, una unidad, etc.
    const purchase = Math.ceil(
      Math.max(0, afterArrival + reserve - availableAtArrival),
    );

    const expectedFinalStock = Math.max(
      0,
      availableAtArrival + purchase - afterArrival,
    );

    const arrival = forecast.points[lead].date;
    const [year, month, day] = arrival.split("-");

    return {
      beforeArrival,
      availableAtArrival,
      uncoveredBeforeArrival,
      purchase,
      expectedFinalStock,
      arrival: `${day}/${month}/${year}`,
    };
  })();

  const worseThanBaseline =
    forecast.evaluation.weeklyMae > forecast.baselineEvaluation.weeklyMae;

  return (
    <View style={styles.card}>
      <Copy accessibilityRole="header" style={styles.title}>
        Simulador de reposición
      </Copy>

      <Copy style={styles.small}>
        Escenario hipotético para {forecast.name}. Todas las cantidades están
        expresadas en {forecast.unit}. Cambia los valores para explorar qué
        pasaría.
      </Copy>

      <View style={styles.fields}>
        <Field
          label={`Existencias al inicio (${forecast.unit})`}
          value={stockText}
          onChange={setStockText}
        />

        <Field
          label="Días completos hasta la entrega · 0 a 6"
          value={leadText}
          onChange={setLeadText}
        />

        <Field
          label={`Reserva deseada al finalizar (${forecast.unit})`}
          value={reserveText}
          onChange={setReserveText}
        />
      </View>

      <Copy style={styles.small}>
        El plazo empieza al inicio del período pronosticado. Cero significa
        entrega inmediata; dos significa entrega al inicio del tercer día.
        Limitamos el escenario a los siete días del pronóstico.
      </Copy>

      {!simulation && (
        <Copy accessibilityRole="alert" style={styles.warning}>
          Escribe números enteros entre 0 y 1.000.000 para existencias y
          reserva. El plazo debe estar entre 0 y 6 días.
        </Copy>
      )}

      {simulation && (
        <>
          {worseThanBaseline && (
            <View style={styles.notice}>
              <Copy style={styles.warning}>
                Este método tuvo más error que el promedio de referencia en la
                evaluación. Usa este escenario para explorar, y revisa el
                pronóstico antes de tomar una decisión.
              </Copy>
            </View>
          )}

          <View style={styles.result}>
            <Copy style={styles.small}>
              Reposición calculada para este escenario
            </Copy>

            <Copy style={styles.quantity}>
              {format(simulation.purchase)} {forecast.unit}
            </Copy>

            <Copy style={styles.small}>
              Entrega supuesta: {simulation.arrival}. Redondeada hacia arriba a
              cantidades enteras.
            </Copy>
          </View>

          {simulation.uncoveredBeforeArrival > 0 ? (
            <View style={styles.notice}>
              <Copy style={styles.warning}>
                Posible faltante antes de recibir el pedido
              </Copy>

              <Copy>
                Las ventas previstas antes de la entrega superan las existencias
                iniciales en {format(simulation.uncoveredBeforeArrival)}{" "}
                {forecast.unit}.
              </Copy>

              <Copy style={styles.small}>
                Una entrega posterior no evita ese faltante. Prueba un plazo
                menor o más existencias iniciales. En este escenario, las ventas
                no atendidas no quedan como pedidos pendientes.
              </Copy>
            </View>
          ) : (
            <Copy style={styles.small}>
              Las existencias iniciales cubren las ventas previstas hasta la
              entrega bajo estos supuestos. No es una garantía.
            </Copy>
          )}

          <View style={styles.details}>
            <Copy>
              Ventas previstas antes de recibir:{" "}
              {format(simulation.beforeArrival)} {forecast.unit}.
            </Copy>

            <Copy>
              Existencias previstas justo antes de recibir:{" "}
              {format(simulation.availableAtArrival)} {forecast.unit}.
            </Copy>

            <Copy>
              Existencias previstas al terminar los siete días:{" "}
              {format(simulation.expectedFinalStock)} {forecast.unit}.
            </Copy>
          </View>

          <Copy style={styles.small}>
            Calculamos lo necesario para cubrir las ventas previstas desde la
            entrega hasta el final del período, más la reserva elegida,
            descontando las existencias disponibles al recibir.
          </Copy>

          <Copy style={styles.small}>
            La reserva la defines tú: no es un stock de seguridad calculado
            estadísticamente. Suponemos una sola entrega, sin otras entradas,
            devoluciones ni pedidos pendientes. No se genera ninguna compra.
          </Copy>
        </>
      )}

      {simulation && stock !== null && lead !== null && reserve !== null && (
        <ForecastAdvisor
          context={buildForecastAdvisorContext(forecast, {
            initialStock: stock,
            leadDays: lead,
            reserve,
          })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 16,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.mint,
  },
  small: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  fields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  field: {
    flexGrow: 1,
    flexBasis: 220,
    gap: 8,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    backgroundColor: colors.bg,
    fontSize: 17,
  },
  result: {
    padding: 18,
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#1d2b1e",
  },
  quantity: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    color: colors.mint,
  },
  notice: {
    padding: 16,
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#242116",
  },
  warning: {
    color: "#f2c879",
  },
  details: {
    gap: 10,
  },
});
