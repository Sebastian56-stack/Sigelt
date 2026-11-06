import {
    validateVisualReport,
    type VisualMonthlyReport,
} from "@/lib/visual-reports";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const num = new Intl.NumberFormat("es-CO");

const pct = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1,
});

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function table(title: string, columns: string[], rows: unknown[][]) {
  return `
    <h2>${escape(title)}</h2>
    <table>
      <thead>
        <tr>
          ${columns.map((c) => `<th>${escape(c)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) => `
                    <tr>
                      ${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}
                    </tr>
                  `,
                )
                .join("")
            : `<tr><td colspan="${columns.length}">Sin registros para mostrar.</td></tr>`
        }
      </tbody>
    </table>
  `;
}

export function buildReportHtml(input: VisualMonthlyReport, nativeIos = false) {
  const month = input.period.month.slice(0, 7);
  const r = validateVisualReport(input, month);

  const title = new Intl.DateTimeFormat("es-CO", {
    timeZone: r.timezone,
    month: "long",
    year: "numeric",
  }).format(new Date(month + "-01T12:00:00Z"));

  const sold = [...r.products_sold].sort(
    (a, b) => b.sales_amount - a.sales_amount || a.code.localeCompare(b.code),
  );

  const days = r.charts.daily_sales;
  const stock = r.charts.stock_distribution;

  const maximum = Math.max(0, ...days.map((d) => d.sales_total ?? 0));

  const step = 570 / days.length;

  const coverage = {
    complete: "Día completo",
    partial: "Día parcial",
    before_inventory: "Anterior al inventario",
    not_elapsed: "Aún no transcurrido",
  };

  const groups = [
    {
      label: "Agotados",
      value: stock.out_of_stock,
      color: "#b54747",
    },
    {
      label: "En el mínimo o por debajo (con existencias)",
      value: stock.low_stock,
      color: "#ae701b",
    },
    {
      label: "Por encima del mínimo",
      value: stock.above_minimum,
      color: "#347346",
    },
  ];

  const circumference = 2 * Math.PI * 55;
  let offset = 0;

  const segments = groups
    .map((group) => {
      const length = stock.active_products
        ? (group.value / stock.active_products) * circumference
        : 0;

      const circle =
        length > 0
          ? `<circle
              cx="85" cy="85" r="55"
              fill="none"
              stroke="${group.color}"
              stroke-width="20"
              stroke-dasharray="${length} ${circumference - length}"
              stroke-dashoffset="${-offset}"
              transform="rotate(-90 85 85)"
            />`
          : "";

      offset += length;
      return circle;
    })
    .join("");

  const notices = [
    r.period.is_current_month
      ? "Mes en curso: las cifras del mes son parciales."
      : "Mes cerrado.",
    r.period.before_inventory_creation
      ? "El inventario aún no existía durante este mes."
      : "",
    r.period.inventory_created_during_month
      ? "El inventario se creó durante este mes; no hay cobertura completa."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const metrics = [
    ["Total vendido", money.format(r.summary.sales_total)],
    ["Ventas confirmadas", num.format(r.summary.sales_count)],
    [
      "Promedio por venta",
      r.summary.average_sale === null
        ? "Sin datos"
        : money.format(r.summary.average_sale),
    ],
    ["Referencias vendidas", num.format(r.summary.distinct_products_sold)],
  ];

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sigelt_Informe_${month}</title>
<style>
  @page {
    size: A4 portrait;
    margin: ${nativeIos ? "0" : "14mm"};
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    color: #1b2920;
    font: 12px/1.5 Arial, sans-serif;
    overflow-wrap: anywhere;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1 { font-size: 27px; margin: 4px 0; }

  h2 {
    font-size: 17px;
    margin: 18px 0 8px;
    break-after: avoid;
  }

  p { margin: 5px 0 10px; }

  header {
    border-bottom: 3px solid #347346;
    padding-bottom: 14px;
  }

  .brand {
    color: #347346;
    font-size: 26px;
    font-weight: bold;
  }

  .muted, small { color: #536458; }

  .notice {
    background: #edf5ec;
    border-left: 3px solid #347346;
    padding: 10px;
    margin: 14px 0;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .metric {
    border: 1px solid #d5dfd5;
    padding: 12px;
    border-radius: 9px;
  }

  .metric strong {
    display: block;
    font-size: 23px;
    color: #245834;
    overflow-wrap: anywhere;
  }

  .chart {
    border: 1px solid #d5dfd5;
    border-radius: 10px;
    padding: 14px;
    margin-top: 14px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .chart h2 { margin-top: 0; }
  svg { display: block; max-width: 100%; }

  .rank {
    margin: 12px 0;
    break-inside: avoid;
    overflow-wrap: anywhere;
  }

  .track {
    height: 10px;
    background: #e5ebe4;
    margin: 5px 0;
  }

  .fill { height: 10px; background: #347346; }

  .stock {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .stock svg { width: 170px; flex-shrink: 0; }
  .stock ul { list-style: none; padding: 0; flex: 1; }
  .stock li { margin: 12px 0; }

  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-right: 5px;
  }

  .details {
    break-before: page;
    page-break-before: always;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 22px;
    font-size: 11px;
  }

  thead { display: table-header-group; }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  th, td {
    padding: 8px 6px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid #d5dfd5;
    overflow-wrap: anywhere;
    word-wrap: break-word;
  }

  th { background: #edf5ec; color: #245834; }

  footer {
    border-top: 1px solid #d5dfd5;
    margin-top: 20px;
    padding-top: 10px;
    font-size: 10px;
  }
</style>
</head>
<body>

<header>
  <div class="brand">sigelt.</div>
  <h1>Informe mensual</h1>
  <p>
    <strong>${escape(r.inventory.name)}</strong>
    · ${escape(title)} · COP
  </p>
  <small>
    Datos consultados: ${escape(dateTime(r.generated_at))} · Colombia
  </small>
</header>

<div class="notice">${escape(notices)}</div>

<div class="metrics">
  ${metrics
    .map(
      ([label, value]) => `
        <div class="metric">
          <span>${escape(label)}</span>
          <strong>${escape(value)}</strong>
        </div>
      `,
    )
    .join("")}
</div>

<section class="chart">
  <h2>Ventas por día</h2>
  <p class="muted">Importes en COP · Ventas confirmadas</p>

  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 650 200"
    role="img"
    aria-label="Ventas diarias"
  >
    ${[0, 0.5, 1]
      .map((ratio) => {
        const y = 160 - ratio * 130;

        return `
          <line
            x1="65" y1="${y}" x2="640" y2="${y}"
            stroke="#d5dfd5"
          />
          <text
            x="59" y="${y + 4}"
            font-size="10"
            text-anchor="end"
            fill="#536458"
          >${escape(compact.format(maximum * ratio))}</text>
        `;
      })
      .join("")}

    ${days
      .map((day, i) => {
        const x = 68 + i * step;

        const height =
          maximum > 0 && day.sales_total !== null
            ? (day.sales_total / maximum) * 130
            : 0;

        return `
          <g>
            <title>
              ${escape(day.date)}:
              ${
                day.sales_total === null
                  ? "Sin observación"
                  : escape(money.format(day.sales_total))
              }
            </title>

            ${
              day.sales_total === null
                ? `<text
                    x="${x + 6}" y="154"
                    text-anchor="middle"
                    fill="#536458"
                  >—</text>`
                : `<rect
                    x="${x}" y="${160 - height}"
                    width="12" height="${height}"
                    fill="${day.coverage === "partial" ? "#ae701b" : "#347346"}"
                  />`
            }

            <text
              x="${x + 6}" y="180"
              font-size="10"
              text-anchor="middle"
              fill="#536458"
            >${day.date.slice(-2)}</text>
          </g>
        `;
      })
      .join("")}
  </svg>

  <small>
    Verde: día completo. Ámbar: día parcial. —: sin observación.
    Los días observados sin importe vendido tienen valor $0.
    El detalle por fecha está en el anexo.
  </small>
</section>

<section class="chart">
  <h2>Productos que más aportan</h2>
  <p class="muted">
    Hasta cinco productos por importe vendido.
    Barras: participación en las ventas del mes.
  </p>

  ${
    sold.length
      ? sold
          .slice(0, 5)
          .map((p, i) => {
            const share =
              r.summary.sales_total > 0
                ? p.sales_amount / r.summary.sales_total
                : 0;

            return `
              <div class="rank">
                <strong>
                  ${i + 1}. ${escape(p.name)}
                  ${p.current_status === "archived" ? " · Archivado" : ""}
                </strong>

                <div>
                  ${escape(money.format(p.sales_amount))} ·
                  ${
                    r.summary.sales_total > 0
                      ? escape(pct.format(share))
                      : "Participación no calculable"
                  }
                </div>

                <div class="track">
                  <div
                    class="fill"
                    style="width:${Math.min(100, share * 100)}%"
                  ></div>
                </div>

                <small>
                  ${escape(p.code)} ·
                  ${escape(num.format(p.quantity_sold))}
                  ${escape(p.unit)}
                </small>
              </div>
            `;
          })
          .join("")
      : "<p>No hay ventas para construir esta gráfica.</p>"
  }

  <small>
    El detalle incluye los ${num.format(sold.length)}
    productos vendidos, sin recortar la lista.
  </small>
</section>

<section class="chart">
  <h2>Estado del inventario · Actual</h2>
  <p class="muted">
    Consultado: ${escape(dateTime(stock.as_of))}.
    No representa el cierre del mes seleccionado.
  </p>

  <div class="stock">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 170 170"
      role="img"
      aria-label="Distribución de productos activos"
    >
      <circle
        cx="85" cy="85" r="55"
        fill="none" stroke="#e5ebe4" stroke-width="20"
      />

      ${segments}

      <text
        x="85" y="85"
        text-anchor="middle"
        font-size="23" fill="#245834"
      >${escape(compact.format(stock.active_products))}</text>

      <text
        x="85" y="104"
        text-anchor="middle"
        font-size="12" fill="#536458"
      >activos</text>
    </svg>

    <ul>
      ${groups
        .map(
          (g) => `
            <li>
              <span class="dot" style="background:${g.color}"></span>
              ${escape(g.label)}:
              <strong>${num.format(g.value)}</strong>
              (${
                stock.active_products
                  ? pct.format(g.value / stock.active_products)
                  : "Sin datos"
              })
            </li>
          `,
        )
        .join("")}
    </ul>
  </div>

  <small>
    Total: ${num.format(stock.active_products)} referencias activas.
    No se suman cajas con unidades.
  </small>
</section>

<div class="details">
  <h1>Detalle del informe</h1>
  <p>${escape(r.inventory.name)} · ${escape(title)} · COP</p>
  <p class="muted">
    Importes al precio de cada venta;
    nombres y unidades del catálogo actual.
  </p>

  ${table(
    "Productos vendidos",
    ["Producto", "Código", "Cantidad", "Unidad", "Importe COP"],
    sold.map((p) => [
      p.name + (p.current_status === "archived" ? " · Archivado" : ""),
      p.code,
      num.format(p.quantity_sold),
      p.unit,
      money.format(p.sales_amount),
    ]),
  )}

  <p>
    <strong>
      Total vendido: ${escape(money.format(r.summary.sales_total))} COP
    </strong>
  </p>

  ${table(
    "Productos sin ventas",
    ["Producto", "Código", "Unidad", "Creado durante el mes"],
    r.products_without_sales.map((p) => [
      p.name,
      p.code,
      p.unit,
      p.created_during_period ? "Sí" : "No",
    ]),
  )}

  <p class="muted">
    Solo productos actualmente activos, creados antes del corte
    y sin ventas confirmadas en el período.
  </p>

  ${table(
    "Existencias por revisar · Actuales",
    ["Producto", "Código", "Unidad", "Disponible", "Mínimo", "Estado"],
    r.current_stock.alerts.map((p) => [
      p.name,
      p.code,
      p.unit,
      num.format(p.stock_quantity),
      num.format(p.min_stock),
      p.alert_type === "out_of_stock" ? "Agotado" : "En el mínimo o por debajo",
    ]),
  )}
</div>

<div class="details">
  ${table(
    "Anexo · Ventas por fecha",
    ["Fecha", "Cobertura", "Ventas confirmadas", "Importe COP"],
    days.map((d) => [
      d.date.split("-").reverse().join("/"),
      coverage[d.coverage],
      d.sales_count === null ? "Sin observación" : num.format(d.sales_count),
      d.sales_total === null ? "Sin observación" : money.format(d.sales_total),
    ]),
  )}

  <footer>
    Sigelt · ${escape(r.inventory.name)} · ${escape(title)}<br>
    Datos consultados: ${escape(dateTime(r.generated_at))}
    · Horario de Colombia.<br>
    Los importes representan ventas, no ganancias.
    Las existencias son actuales.
    Este documento conserva las cifras del informe consultado.
  </footer>
</div>

</body>
</html>`;
}
