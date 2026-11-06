export type SalesDay = {
  date: string;
  quantity: number | null;
  observation: "recorded" | "stockout" | "missing";
};

export type SalesSeries = {
  id: string;
  name: string;
  unit: string;
  scenario: string;
  days: SalesDay[];
};

export type ForecastDemo = {
  schemaVersion: 1;
  source: "synthetic";
  seed: number;
  startDate: string;
  endDate: string;
  products: SalesSeries[];
};

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function countWithNoise(mean: number, random: () => number) {
  const limit = Math.exp(-mean);
  let product = 1;
  let count = 0;

  do {
    count += 1;
    product *= random();
  } while (product > limit);

  return count - 1;
}

export function createForecastDemo(seed = 1601): ForecastDemo {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error("La semilla debe ser un entero entre 0 y 4294967295.");
  }

  // Fechas fijas para repetir y comparar los experimentos.
  const start = Date.UTC(2026, 4, 9);
  const totalDays = 180;

  const dateAt = (index: number) =>
    new Date(start + index * 86400000).toISOString().slice(0, 10);

  const definitions = [
    {
      name: "Cuaderno",
      unit: "unidad",
      scenario: "estable",
    },
    {
      name: "Lápiz",
      unit: "unidad",
      scenario: "crecimiento",
    },
    {
      name: "Resma de papel",
      unit: "resma",
      scenario: "semanal",
    },
    {
      name: "Caja de colores",
      unit: "caja",
      scenario: "intermitente",
    },
    {
      name: "Marcador",
      unit: "unidad",
      scenario: "disponibilidad_limitada",
    },
    {
      name: "Adhesivos",
      unit: "paquete",
      scenario: "producto_nuevo",
    },
  ];

  const products: SalesSeries[] = definitions.map((definition, index) => {
    const random = seededRandom((seed + (index + 1) * 1009) >>> 0);

    const days: SalesDay[] = [];

    // El producto nuevo solo tiene siete días de historia.
    const firstDay = definition.scenario === "producto_nuevo" ? 173 : 0;

    for (let day = firstDay; day < totalDays; day += 1) {
      const date = dateAt(day);

      const weekday = new Date(start + day * 86400000).getUTCDay();

      let mean = 7;

      if (definition.scenario === "crecimiento") {
        mean = 2 + day * 0.055;
      }

      if (definition.scenario === "semanal") {
        mean = [2, 5, 7, 8, 9, 12, 4][weekday];
      }

      if (definition.scenario === "producto_nuevo") {
        mean = 3;
      }

      let quantity: number | null = countWithNoise(mean, random);

      let observation: SalesDay["observation"] = "recorded";

      if (definition.scenario === "intermitente") {
        quantity = random() < 0.16 ? 1 + Math.floor(random() * 7) : 0;
      }

      if (definition.scenario === "disponibilidad_limitada") {
        if (day >= 60 && day <= 66) {
          // No sabemos cuánto se vendió.
          observation = "missing";
          quantity = null;
        } else if ((day >= 100 && day <= 109) || (day >= 150 && day <= 155)) {
          observation = "stockout";

          // Venta limitada por disponibilidad.
          // No revela cuánta demanda quedó sin atender.
          quantity = Math.min(quantity, Math.floor(random() * 2));
        }
      }

      days.push({
        date,
        quantity,
        observation,
      });
    }

    return {
      id: `demo-${index + 1}`,
      ...definition,
      days,
    };
  });

  return {
    schemaVersion: 1,
    source: "synthetic",
    seed,
    startDate: dateAt(0),
    endDate: dateAt(totalDays - 1),
    products,
  };
}
