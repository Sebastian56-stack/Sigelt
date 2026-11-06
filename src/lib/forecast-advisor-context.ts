import type { ProductForecast } from "./forecast-engine";
import { MODEL_LABELS } from "./forecast-engine";

type ReadyForecast = Extract<ProductForecast, { status: "ready" }>;

export type AdvisorInputs = {
  initialStock: number;
  leadDays: number;
  reserve: number;
};

function simulate(quantities: number[], inputs: AdvisorInputs) {
  const beforeArrival = quantities
    .slice(0, inputs.leadDays)
    .reduce((sum, quantity) => sum + quantity, 0);

  const afterArrival = quantities
    .slice(inputs.leadDays)
    .reduce((sum, quantity) => sum + quantity, 0);

  const stockAtArrival = Math.max(0, inputs.initialStock - beforeArrival);
  const unmetBeforeArrival = Math.max(0, beforeArrival - inputs.initialStock);
  const replenishment = Math.ceil(
    Math.max(0, afterArrival + inputs.reserve - stockAtArrival),
  );

  return {
    beforeArrival,
    stockAtArrival,
    unmetBeforeArrival,
    replenishment,
    endingStock: Math.max(0, stockAtArrival + replenishment - afterArrival),
  };
}

export function buildForecastAdvisorContext(
  forecast: ReadyForecast,
  inputs: AdvisorInputs,
) {
  if (forecast.source !== "synthetic") {
    throw new Error("Este bloque analiza únicamente escenarios sintéticos.");
  }

  const { initialStock, leadDays, reserve } = inputs;

  if (
    !Number.isSafeInteger(initialStock) ||
    initialStock < 0 ||
    initialStock > 1000000 ||
    !Number.isSafeInteger(reserve) ||
    reserve < 0 ||
    reserve > 1000000 ||
    !Number.isSafeInteger(leadDays) ||
    leadDays < 0 ||
    leadDays > 6
  ) {
    throw new Error(
      "Revisa las existencias, la reserva y el plazo de entrega.",
    );
  }

  if (
    forecast.points.length !== 7 ||
    forecast.points.some(
      (point) => !Number.isFinite(point.quantity) || point.quantity < 0,
    ) ||
    !Number.isFinite(forecast.evaluation.weeklyMae) ||
    forecast.evaluation.weeklyMae < 0 ||
    !Number.isFinite(forecast.baselineEvaluation.weeklyMae) ||
    forecast.baselineEvaluation.weeklyMae < 0
  ) {
    throw new Error("El pronóstico no contiene resultados válidos.");
  }

  const quantities = forecast.points.map((point) => point.quantity);
  const selected = simulate(quantities, inputs);
  const immediate = simulate(quantities, { ...inputs, leadDays: 0 });
  const total = quantities.reduce((sum, quantity) => sum + quantity, 0);

  return {
    schemaVersion: 1 as const,
    source: "synthetic" as const,
    product: {
      name: forecast.name,
      unit: forecast.unit,
    },
    forecast: {
      asOf: forecast.asOf,
      model: forecast.model,
      modelLabel: MODEL_LABELS[forecast.model],
      points: forecast.points.map((point) => ({ ...point })),
      total,
    },
    evaluation: {
      weeklyMae: forecast.evaluation.weeklyMae,
      baselineWeeklyMae: forecast.baselineEvaluation.weeklyMae,
      weeks: forecast.evaluation.weeks,
      worseThanBaseline:
        forecast.evaluation.weeklyMae > forecast.baselineEvaluation.weeklyMae,
    },
    scenario: {
      initialStock,
      leadDays,
      reserve,
      arrivalDate: forecast.points[leadDays].date,
      ...selected,
    },
    comparisons: {
      immediateDelivery: {
        arrivalDate: forecast.points[0].date,
        ...immediate,
      },
      initialStockToCoverLeadDays: Math.ceil(selected.beforeArrival),
      extraInitialStockToCoverLeadDays: Math.ceil(selected.unmetBeforeArrival),
    },
    assumptions: {
      horizonDays: 7,
      singleDelivery: true,
      unmetSalesAreBackorders: false,
      reserveIsUserDefined: true,
      includesOtherReceipts: false,
      modifiesInventory: false,
    },
  };
}

export type ForecastAdvisorContext = ReturnType<
  typeof buildForecastAdvisorContext
>;
