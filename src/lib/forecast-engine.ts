import type { SalesDay, SalesSeries } from "./forecast-demo";

export const MODEL_LABELS = {
  mean28: "Promedio de 28 días",
  weekday: "Promedio por día de la semana",
  smoothing: "Suavizado exponencial",
};

type Model = keyof typeof MODEL_LABELS;

type Source = "synthetic" | "operational";

type Point = {
  date: string;
  quantity: number;
};

type Metrics = {
  weeklyMae: number;
  dailyMae: number;
  weeks: number;
};

type Base = {
  productId: string;
  name: string;
  unit: string;
  source: Source;
};

export type ProductForecast = Base &
  (
    | {
        status: "insufficient_history" | "insufficient_quality";
        reason: string;
      }
    | {
        status: "ready";
        asOf: string;
        model: Model;
        points: Point[];
        total: number;
        validation: {
          model: Model;
          metrics: Metrics;
        }[];
        evaluation: Metrics;
        baselineEvaluation: Metrics;
        improvementPercent: number | null;
      }
  );

const DAY = 86400000;
const HORIZON = 7;

// Política inicial del módulo:
// 56 días de entrenamiento,
// 28 días para elegir el método,
// 28 días para evaluar el método elegido.
const MIN_DAYS = 112;

const MODELS: Model[] = ["mean28", "weekday", "smoothing"];

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function timestamp(date: string) {
  const value = Date.parse(date + "T00:00:00Z");

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 10) !== date
  ) {
    throw new Error("El historial contiene una fecha inválida.");
  }

  return value;
}

function validate(days: SalesDay[]) {
  let previous: number | undefined;

  for (const day of days) {
    const current = timestamp(day.date);

    if (previous !== undefined && current - previous !== DAY) {
      throw new Error(
        "El historial debe tener un registro por día, ordenado y sin duplicados.",
      );
    }

    previous = current;

    if (!["recorded", "stockout", "missing"].includes(day.observation)) {
      throw new Error("Estado de observación inválido.");
    }

    if (day.observation === "missing") {
      if (day.quantity !== null) {
        throw new Error("Un registro faltante debe tener cantidad null.");
      }
    } else if (
      day.quantity === null ||
      !Number.isSafeInteger(day.quantity) ||
      day.quantity < 0
    ) {
      throw new Error(
        "Las cantidades registradas deben ser enteros no negativos.",
      );
    }
  }
}

function predict(history: SalesDay[], model: Model): Point[] {
  const recent = history.slice(-56);

  const values = recent.map((day) => {
    if (day.observation !== "recorded" || day.quantity === null) {
      throw new Error(
        "No se puede ajustar el modelo con días sin observación completa.",
      );
    }

    return day.quantity;
  });

  const mean = average(values.slice(-28));

  let level = values[0];

  for (const value of values.slice(1)) {
    level = 0.3 * value + 0.7 * level;
  }

  const last = timestamp(recent[recent.length - 1].date);

  return Array.from({ length: HORIZON }, (_, index) => {
    const next = new Date(last + (index + 1) * DAY);

    let quantity = model === "smoothing" ? level : mean;

    if (model === "weekday") {
      const sameWeekday = recent
        .filter(
          (day) =>
            new Date(timestamp(day.date)).getUTCDay() === next.getUTCDay(),
        )
        .map((day) => day.quantity as number);

      quantity = average(sameWeekday);
    }

    return {
      date: next.toISOString().slice(0, 10),
      quantity: Math.max(0, quantity),
    };
  });
}

function evaluate(
  days: SalesDay[],
  model: Model,
  start: number,
  end: number,
): Metrics {
  let weeklyError = 0;
  let dailyError = 0;
  let weeks = 0;

  for (let cut = start; cut + HORIZON <= end; cut += HORIZON) {
    // Solo usamos fechas anteriores al período pronosticado.
    const predictions = predict(days.slice(0, cut), model);

    const actual = days.slice(cut, cut + HORIZON);

    let predictedTotal = 0;
    let actualTotal = 0;

    predictions.forEach((point, index) => {
      const value = actual[index].quantity as number;

      predictedTotal += point.quantity;
      actualTotal += value;

      dailyError += Math.abs(point.quantity - value);
    });

    weeklyError += Math.abs(predictedTotal - actualTotal);

    weeks += 1;
  }

  return {
    weeklyMae: weeklyError / weeks,
    dailyMae: dailyError / (weeks * HORIZON),
    weeks,
  };
}

export function forecastProduct(
  series: SalesSeries,
  source: Source,
): ProductForecast {
  const base: Base = {
    productId: series.id,
    name: series.name,
    unit: series.unit,
    source,
  };

  validate(series.days);

  if (series.days.length < MIN_DAYS) {
    return {
      ...base,
      status: "insufficient_history",
      reason:
        `Hay ${series.days.length} días. ` +
        `Esta versión requiere al menos ${MIN_DAYS} ` +
        "para ajustar y evaluar.",
    };
  }

  const days = series.days.slice(-MIN_DAYS);

  const incomplete = days.filter((day) => day.observation !== "recorded");

  if (incomplete.length > 0) {
    return {
      ...base,
      status: "insufficient_quality",
      reason:
        `Hay ${incomplete.length} días con faltantes ` +
        `o agotados en los últimos ${MIN_DAYS}. ` +
        "Requieren tratamiento antes de pronosticar.",
    };
  }

  // Cuatro semanas para seleccionar.
  // Las últimas cuatro quedan aparte para evaluar.
  const validationStart = days.length - 56;
  const testStart = days.length - 28;

  const validation = MODELS.map((model) => ({
    model,
    metrics: evaluate(days, model, validationStart, testStart),
  })).sort(
    (a, b) =>
      a.metrics.weeklyMae - b.metrics.weeklyMae ||
      MODELS.indexOf(a.model) - MODELS.indexOf(b.model),
  );

  const model = validation[0].model;

  const evaluation = evaluate(days, model, testStart, days.length);

  // Referencia sencilla para comprobar si hubo mejora.
  const baselineEvaluation = evaluate(days, "mean28", testStart, days.length);

  // Pronóstico final utilizando el historial disponible.
  const points = predict(days, model);

  return {
    ...base,
    status: "ready",
    asOf: days[days.length - 1].date,
    model,
    points,
    total: points.reduce((sum, point) => sum + point.quantity, 0),
    validation,
    evaluation,
    baselineEvaluation,
    improvementPercent:
      baselineEvaluation.weeklyMae === 0
        ? null
        : (100 * (baselineEvaluation.weeklyMae - evaluation.weeklyMae)) /
          baselineEvaluation.weeklyMae,
  };
}
