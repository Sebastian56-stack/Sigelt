import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import {
  lowStock,
  money,
  monthlySummary,
  months,
  products,
  sales,
  saleTotal,
  stockTotal,
} from "./demo-data";
import {
  Brand,
  colors,
  Copy,
  font,
  Icon,
  type IconName,
  s
} from "./primitives";

const tabs = [
  { id: "inventory", label: "Inventario", icon: "box" },
  { id: "sales", label: "Ventas", icon: "receipt" },
  { id: "report", label: "Informe mensual", icon: "chart" },
] as const;
export type DemoTab = (typeof tabs)[number]["id"];

function Stat({
  label,
  value,
  detail,
  full = false,
}: {
  label: string;
  value: string;
  detail: string;
  full?: boolean;
}) {
  return (
    <View style={[d.stat, full && { flexBasis: "100%" }]}>
      <Copy style={d.label}>{label}</Copy>
      <Copy style={d.value}>{value}</Copy>
      <Copy style={d.detail}>{detail}</Copy>
    </View>
  );
}

export function ProductDemo({
  compact,
  tab,
  setTab,
}: {
  compact: boolean;
  tab: DemoTab;
  setTab: (tab: DemoTab) => void;
}) {
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [month, setMonth] = useState(1);
  const [selectedSale, setSelectedSale] = useState<string | null>(null);
  const summary = monthlySummary(month);
  const visibleProducts = products.filter(
    (product) =>
      `${product.name} ${product.id}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")) &&
      (!onlyLow || product.stock <= product.minimum),
  );
  const chosenSale = sales.find(
    (sale) => sale.id === selectedSale && sale.month === month,
  );

  return (
    <View style={[s.panel, d.shell]} testID="product-demo">
      <View style={[d.top, compact && { paddingHorizontal: 18 }]}>
        <View style={s.row}>
          <Brand small />
          {!compact && (
            <>
              <View style={d.divider} />
              <Copy style={d.label}>Papelería</Copy>
            </>
          )}
        </View>
      </View>
      <View style={[d.body, compact && { flexDirection: "column" }]}>
        <View style={[d.sidebar, compact && d.mobileTabs]}>
          {!compact && <Copy style={d.workspace}>TU ESPACIO</Copy>}
          {tabs.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === item.id }}
              accessibilityLabel={`Ver ${item.label}`}
              onPress={() => setTab(item.id)}
              testID="demo-tab"
              style={[
                d.tab,
                compact && {
                  flex: 1,
                  justifyContent: "center",
                  paddingHorizontal: 6,
                  gap: 6,
                },
                tab === item.id && d.tabActive,
              ]}
            >
              <Icon
                name={item.icon}
                color={tab === item.id ? colors.mint : colors.muted}
                size={18}
              />
              <Copy
                style={{
                  fontSize: compact ? 12 : 14,
                  fontWeight: tab === item.id ? "600" : "400",
                  color: tab === item.id ? colors.text : colors.muted,
                }}
              >
                {compact && item.id === "report" ? "Informe" : item.label}
              </Copy>
            </Pressable>
          ))}
          {!compact && (
            <View style={d.sideNote}>
              <Icon name="monitor" size={19} />
              <Copy style={d.detail}>
                Un vistazo a tu próximo espacio de trabajo.
              </Copy>
              <View style={d.sideLine} />
              <Copy style={d.detail}>Moneda: COP</Copy>
            </View>
          )}
        </View>
        <View
          style={[d.content, compact && { padding: 18 }]}
          accessibilityLiveRegion="polite"
        >
          <View style={[d.headingRow, compact && { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Copy accessibilityRole="header" headingLevel={3} style={d.title}>
                {tab === "inventory"
                  ? "Todo en su lugar."
                  : tab === "sales"
                    ? "Cada venta cuenta."
                    : "Un mes más claro."}
              </Copy>
              <Copy style={d.detail}>
                {tab === "inventory"
                  ? "Conoce lo que tienes y lo que necesita atención."
                  : tab === "sales"
                    ? "Selecciona una venta para ver su detalle."
                    : "Indicadores calculados con los datos de esta demo."}
              </Copy>
            </View>
            {!compact && (
              <Icon
                name={
                  tab === "inventory"
                    ? "box"
                    : tab === "sales"
                      ? "receipt"
                      : "spark"
                }
                color={colors.mint}
                size={26}
              />
            )}
          </View>
          {tab === "inventory" ? (
            <>
              <View style={[d.stats, compact && { flexWrap: "wrap" }]}>
                <Stat
                  label="Productos"
                  value={String(products.length).padStart(2, "0")}
                  detail="En el catálogo"
                />
                <Stat
                  label="Existencias"
                  value={String(stockTotal)}
                  detail="Unidades disponibles"
                />
                <Stat
                  label="Por revisar"
                  value={String(lowStock.length).padStart(2, "0")}
                  detail="Con existencias bajas"
                />
              </View>
              <View
                style={[
                  d.tools,
                  compact && { flexDirection: "column", alignItems: "stretch" },
                ]}
              >
                <View style={d.search}>
                  <Icon name="search" size={17} />
                  <TextInput
                    accessibilityLabel="Buscar producto por nombre o código"
                    placeholder="Buscar un producto..."
                    placeholderTextColor="#8b978e"
                    value={search}
                    onChangeText={setSearch}
                    style={d.input}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: onlyLow }}
                  onPress={() => setOnlyLow(!onlyLow)}
                  style={[
                    d.filter,
                    onlyLow && {
                      backgroundColor: "#263726",
                      borderColor: "#526c4d",
                    },
                  ]}
                >
                  <Icon
                    name="alert"
                    size={16}
                    color={onlyLow ? colors.mint : colors.muted}
                  />
                  <Copy
                    style={{
                      fontSize: 13,
                      color: onlyLow ? colors.mint : colors.muted,
                    }}
                  >
                    Existencias bajas
                  </Copy>
                </Pressable>
              </View>
              <View style={d.tableHead}>
                <Copy style={[d.tableLabel, { flex: 1 }]}>PRODUCTO</Copy>
                {!compact && (
                  <Copy style={[d.tableLabel, { width: 105 }]}>
                    PRECIO / UND.
                  </Copy>
                )}
                <Copy
                  style={[
                    d.tableLabel,
                    { width: compact ? 82 : 110, textAlign: "right" },
                  ]}
                >
                  EXISTENCIAS
                </Copy>
              </View>
              {visibleProducts.map((product) => (
                <View key={product.id} style={d.productRow}>
                  <View
                    style={[
                      d.productIcon,
                      compact && { width: 32, height: 38 },
                    ]}
                  >
                    <Icon name={product.icon} size={21} color="#bdc9bc" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Copy
                      style={{ fontSize: compact ? 13 : 14, lineHeight: 20 }}
                    >
                      {product.name}
                    </Copy>
                    <Copy style={d.detail}>
                      {compact ? money(product.price) : product.detail}
                    </Copy>
                  </View>
                  {!compact && (
                    <Copy style={{ fontSize: 13, width: 105 }}>
                      {money(product.price)}
                    </Copy>
                  )}
                  <View
                    style={{
                      width: compact ? 66 : 100,
                      alignItems: "flex-end",
                    }}
                  >
                    <Copy style={{ fontSize: 15, fontWeight: "500" }}>
                      {product.stock}
                      <Copy style={d.detail}> und.</Copy>
                    </Copy>
                    {product.stock <= product.minimum && (
                      <Copy
                        style={{
                          color: colors.mint,
                          fontSize: 11,
                          lineHeight: 17,
                        }}
                      >
                        Por reponer
                      </Copy>
                    )}
                  </View>
                </View>
              ))}
              {visibleProducts.length === 0 && (
                <View style={d.empty}>
                  <Icon name="search" size={25} />
                  <Copy style={{ textAlign: "center" }}>
                    No encontramos productos.
                  </Copy>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSearch("");
                      setOnlyLow(false);
                    }}
                    style={d.filter}
                  >
                    <Copy style={{ color: colors.mint, fontSize: 14 }}>
                      Limpiar búsqueda y filtro
                    </Copy>
                  </Pressable>
                </View>
              )}
              <Copy style={[d.detail, { marginTop: 14 }]}>
                {visibleProducts.length} de {products.length} productos ·
                Existencias de ejemplo
              </Copy>
            </>
          ) : (
            <>
              <View style={d.monthPicker}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver agosto de 2026"
                  accessibilityState={{ disabled: month === 0 }}
                  disabled={month === 0}
                  onPress={() => {
                    setMonth(0);
                    setSelectedSale(null);
                  }}
                  style={[d.monthArrow, month === 0 && { opacity: 0.3 }]}
                >
                  <Icon name="back" size={18} />
                </Pressable>
                <Copy style={{ fontSize: 14 }}>{months[month]}</Copy>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver septiembre de 2026"
                  accessibilityState={{ disabled: month === 1 }}
                  disabled={month === 1}
                  onPress={() => {
                    setMonth(1);
                    setSelectedSale(null);
                  }}
                  style={[d.monthArrow, month === 1 && { opacity: 0.3 }]}
                >
                  <Icon name="chevron" size={18} />
                </Pressable>
              </View>
              <View style={[d.stats, compact && { flexWrap: "wrap" }]}>
                <Stat
                  full={compact}
                  label="Ventas · COP"
                  value={money(summary.total)}
                  detail="Importe vendido"
                />
                <Stat
                  label="Operaciones"
                  value={String(summary.records.length).padStart(2, "0")}
                  detail="Ventas registradas"
                />
                <Stat
                  label="Unidades"
                  value={String(summary.units)}
                  detail="Productos vendidos"
                />
              </View>
              {tab === "sales" ? (
                <>
                  {[...summary.records].reverse().map((sale) => (
                    <Pressable
                      key={sale.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Detalle de venta ${sale.id}, ${sale.date}, ${money(saleTotal(sale))}`}
                      accessibilityState={{
                        expanded: chosenSale?.id === sale.id,
                      }}
                      onPress={() =>
                        setSelectedSale(
                          chosenSale?.id === sale.id ? null : sale.id,
                        )
                      }
                      style={[
                        d.saleRow,
                        chosenSale?.id === sale.id && {
                          backgroundColor: "#1e2b1e",
                        },
                      ]}
                    >
                      <View style={d.productIcon}>
                        <Icon name="receipt" color={colors.mint} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Copy style={{ fontSize: 14 }}>{sale.id}</Copy>
                        <Copy style={d.detail}>
                          {sale.date} · {sale.time}
                        </Copy>
                      </View>
                      <Copy style={{ fontSize: 14 }}>
                        {money(saleTotal(sale))}
                      </Copy>
                      <Icon name="chevron" size={17} />
                    </Pressable>
                  ))}
                  {chosenSale && (
                    <View style={d.report}>
                      <Copy style={{ fontSize: 15, fontWeight: "600" }}>
                        Detalle · {chosenSale.id}
                      </Copy>
                      {chosenSale.items.map((item) => (
                        <View key={item.product} style={d.detailLine}>
                          <Copy style={[d.detail, { flex: 1 }]}>
                            {item.quantity} × {products[item.product].name}
                            {"\n"}
                            {money(products[item.product].price)} / unidad
                          </Copy>
                          <Copy style={{ fontSize: 14 }}>
                            {money(
                              products[item.product].price * item.quantity,
                            )}
                          </Copy>
                        </View>
                      ))}
                      <Copy style={{ fontSize: 15, textAlign: "right" }}>
                        Total: {money(saleTotal(chosenSale))}
                      </Copy>
                    </View>
                  )}
                  <Copy style={[d.detail, { marginTop: 20 }]}>
                    Ventas sintéticas para explorar la interfaz.
                  </Copy>
                </>
              ) : (
                <View style={{ gap: 22 }}>
                  <View style={{ gap: 12 }}>
                    <Copy style={{ fontSize: 14, fontWeight: "500" }}>
                      Productos vendidos · unidades
                    </Copy>
                    {summary.ranking.map((item, index) => (
                      <View key={item.name} style={d.rankRow}>
                        <Copy
                          numberOfLines={1}
                          style={{
                            width: compact ? 125 : 185,
                            fontSize: 12,
                            color: colors.muted,
                          }}
                        >
                          {item.name}
                        </Copy>
                        <View style={d.track}>
                          <View
                            style={{
                              width: `${(item.quantity / summary.ranking[0].quantity) * 100}%`,
                              minWidth: 3,
                              height: 6,
                              borderRadius: 6,
                              backgroundColor:
                                index === 0 ? colors.mint : "#536650",
                            }}
                          />
                        </View>
                        <Copy
                          style={{
                            fontSize: 12,
                            width: 20,
                            textAlign: "right",
                          }}
                        >
                          {item.quantity}
                        </Copy>
                      </View>
                    ))}
                  </View>
                  <View style={d.report}>
                    <View style={s.row}>
                      <Icon name="spark" color={colors.mint} />
                      <Copy style={{ fontSize: 14, fontWeight: "600" }}>
                        Los números, en palabras.
                      </Copy>
                    </View>
                    <Copy
                      style={{ fontSize: 14, lineHeight: 23, color: "#c3cdc4" }}
                    >
                      En {months[month].toLowerCase()} se vendieron{" "}
                      {summary.units} unidades. Más vendidos:{" "}
                      {summary.most.map((item) => item.name).join(", ")} (
                      {summary.most[0].quantity} unidades
                      {summary.most.length > 1 ? " cada uno" : ""}). Menos
                      vendidos:{" "}
                      {summary.least.map((item) => item.name).join(", ")} (
                      {summary.least[0].quantity} unidades
                      {summary.least.length > 1 ? " cada uno" : ""}).
                    </Copy>
                    <Copy
                      style={{ fontSize: 14, lineHeight: 23, color: "#c3cdc4" }}
                    >
                      {summary.change === null
                        ? "No hay datos del mes anterior para comparar."
                        : `El importe vendido aumentó un ${summary.change}% frente al mes anterior. Estos datos no permiten determinar la causa.`}{" "}
                      Revisa los marcadores: quedan {lowStock[0].stock}, por
                      debajo del mínimo de {lowStock[0].minimum}.
                    </Copy>
                    <Copy
                      style={{
                        fontSize: 12,
                        lineHeight: 19,
                        color: colors.muted,
                      }}
                    >
                      Ejemplo de informe · texto ilustrativo, no generado por
                      IA. La alerta usa las existencias actuales de la demo.
                    </Copy>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function MiniProduct({
  name,
  stock,
  icon,
}: {
  name: string;
  stock: number;
  icon: IconName;
}) {
  return (
    <View style={[d.productRow, { paddingVertical: 13 }]}>
      <View style={d.productIcon}>
        <Icon name={icon} color="#bdc9bc" />
      </View>
      <View style={{ flex: 1 }}>
        <Copy style={{ fontSize: 13 }}>{name}</Copy>
        <Copy style={d.detail}>Disponible</Copy>
      </View>
      <Copy style={{ fontSize: 17 }}>
        {stock}
        <Copy style={d.detail}> und.</Copy>
      </Copy>
    </View>
  );
}

const d = StyleSheet.create({
  shell: { overflow: "hidden", width: "100%" },
  top: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#151a16",
    gap: 12,
  },
  divider: {
    height: 18,
    width: 1,
    backgroundColor: "#3a423b",
    marginHorizontal: 12,
  },
  body: { flexDirection: "row", minHeight: 590 },
  sidebar: {
    width: 180,
    padding: 16,
    borderRightWidth: 1,
    borderColor: colors.border,
    gap: 6,
    backgroundColor: "#101411",
  },
  mobileTabs: {
    width: "100%",
    flexDirection: "row",
    borderRightWidth: 0,
    borderBottomWidth: 1,
    padding: 8,
  },
  workspace: {
    color: "#8f9b91",
    fontSize: 10,
    letterSpacing: 1.6,
    marginTop: 16,
    marginBottom: 16,
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tabActive: { backgroundColor: "#253024" },
  sideNote: { marginTop: "auto", padding: 12, gap: 12 },
  sideLine: { height: 1, backgroundColor: colors.border },
  content: { flex: 1, padding: 30, minWidth: 0 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 25,
    letterSpacing: -0.8,
    lineHeight: 36,
    marginBottom: 4,
    fontWeight: "500",
  },
  label: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  stats: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 25,
    overflow: "hidden",
  },
  stat: { flex: 1, gap: 5, padding: 10, minWidth: 0 },
  value: { fontSize: 26, fontWeight: "500", lineHeight: 35, letterSpacing: -1 },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: "#343d35",
    borderRadius: 8,
    flex: 1,
    minHeight: 44,
    gap: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    padding: 10,
    paddingLeft: 0,
    fontFamily: font,
    fontSize: 14,
  },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#343d35",
  },
  tableHead: {
    flexDirection: "row",
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tableLabel: { color: "#98a299", fontSize: 10, letterSpacing: 0.7 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#242c25",
  },
  productIcon: {
    width: 40,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1c241d",
    borderRadius: 8,
  },
  empty: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  monthPicker: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    marginBottom: 18,
    alignSelf: "flex-start",
  },
  monthArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  saleRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  report: {
    padding: 20,
    borderWidth: 1,
    borderColor: "#354732",
    backgroundColor: "#182118",
    borderRadius: 12,
    gap: 14,
    marginTop: 8,
  },
  detailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#354732",
  },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  track: { flex: 1, height: 6, borderRadius: 6, backgroundColor: "#273027" },
});
