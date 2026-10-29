import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { useHydrated } from "@/hooks/use-hydrated";
import { router } from "expo-router";
import { lowStock, products, stockTotal } from "./demo-data";
import {
  Action,
  Badge,
  Brand,
  colors,
  Copy,
  Eyebrow,
  Icon,
  s,
  SectionTitle,
  type IconName,
} from "./primitives";
import { MiniProduct, ProductDemo, type DemoTab } from "./product-demo";

type Section = "inicio" | "producto" | "informes" | "conexion";
const navigation: { id: Section; label: string; icon: IconName }[] = [
  { id: "inicio", label: "Inicio", icon: "grid" },
  { id: "producto", label: "Producto", icon: "box" },
  { id: "informes", label: "Informes", icon: "chart" },
];
const modules: { name: string; icon: IconName; description: string }[] = [
  {
    name: "Productos",
    icon: "box",
    description:
      "Un catálogo organizado, con precios y existencias a la vista.",
  },
  {
    name: "Entradas",
    icon: "entry",
    description: "Cada entrada suma unidades al inventario del producto.",
  },
  {
    name: "Ventas",
    icon: "receipt",
    description:
      "Al confirmar una venta se revisan y descuentan las existencias.",
  },
  {
    name: "Informes",
    icon: "chart",
    description:
      "Los registros se convierten en indicadores mensuales y explicaciones claras.",
  },
];

function HeroArtwork({ compact }: { compact: boolean }) {
  return (
    <View style={[l.art, compact && l.artCompact]} testID="hero-art">
      <View testID="hero-orbit" style={l.heroOrbit} />
      <View testID="hero-halo" style={l.halo} />
      <View
        style={[
          l.notebook,
          compact && { right: 30, top: 25, width: 135, height: 185 },
        ]}
        testID="notebook"
      >
        <View style={l.spine} />
        <Icon name="logo" color="#c5efb5" size={46} />
        <Copy style={{ color: "#c3d2bd", fontSize: 12, letterSpacing: 3 }}>
          SIGELT
        </Copy>
        <View style={l.notebookLine} />
      </View>
      <View
        style={[
          l.heroCard,
          compact && { left: 8, top: 102, width: "91%", padding: 18 },
        ]}
        testID="hero-inventory"
      >
        <View style={l.spread}>
          <View style={s.row}>
            <Icon name="box" color={colors.mint} />
            <Copy style={{ fontSize: 14, fontWeight: "500" }}>
              Tu inventario
            </Copy>
          </View>
          <View style={l.liveDot} />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 8,
            marginTop: 17,
          }}
        >
          <Copy style={{ fontSize: 45, lineHeight: 55, letterSpacing: -2 }}>
            {stockTotal}
          </Copy>
          <Copy style={{ fontSize: 13, color: colors.muted }}>
            unidades en orden
          </Copy>
        </View>
        {products.slice(0, 2).map((product) => (
          <MiniProduct
            key={product.id}
            name={product.name}
            icon={product.icon}
            stock={product.stock}
          />
        ))}
        <View style={[l.spread, { marginTop: 15 }]}>
          <Copy style={{ fontSize: 11, color: colors.muted }}>PAPELERÍA</Copy>
          <Copy style={{ fontSize: 11, color: colors.mint }}>
            Datos sintéticos
          </Copy>
        </View>
      </View>
      <View
        style={[l.floatingNote, compact && { right: 0, bottom: 8 }]}
        testID="hero-note"
      >
        <View style={l.checkCircle}>
          <Icon name="check" color={colors.mint} size={19} />
        </View>
        <View>
          <Copy style={{ fontSize: 13, fontWeight: "500" }}>
            Cada movimiento, conectado.
          </Copy>
          <Copy style={{ fontSize: 12, color: colors.muted }}>
            De la venta al inventario.
          </Copy>
        </View>
      </View>
      {!compact && (
        <View style={l.annotation}>
          <View style={l.annotationLine} />
          <Copy style={{ fontSize: 11, color: "#acb8ab" }}>
            UN LUGAR PARA TENERLO CLARO
          </Copy>
        </View>
      )}
    </View>
  );
}

export default function SigeltLanding() {
  const { width: viewportWidth } = useWindowDimensions();
  const hasHydrated = useHydrated();
  const width = hasHydrated ? viewportWidth : 1200;
  const compact = width < 760;
  const tablet = width < 1050;
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<Section, number>>({
    inicio: 0,
    producto: 0,
    informes: 0,
    conexion: 0,
  });
  const [active, setActive] = useState<Section>("inicio");
  const [module, setModule] = useState(0);
  const [demoTab, setDemoTab] = useState<DemoTab>("inventory");
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.title = "Sigelt · Gestión de inventario y ventas";
    document.documentElement.lang = "es";
    if (reduceMotion || typeof IntersectionObserver === "undefined") return;
    document.documentElement.classList.add("sigelt-motion");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.06 },
    );
    document
      .querySelectorAll('[data-testid="reveal"]')
      .forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("sigelt-motion");
    };
  }, [reduceMotion]);

  const goTo = (section: Section) => {
    setActive(section);
    scroller.current?.scrollTo({
      y: Math.max(0, positions.current[section] - (compact ? 88 : 118)),
      animated: !reduceMotion,
    });
  };
  const register = (section: Section, y: number) => {
    positions.current[section] = y;
  };

  return (
    <View style={l.root}>
      <View
        style={[l.headerWrap, compact && { top: 12, paddingHorizontal: 12 }]}
        pointerEvents="box-none"
      >
        <View
          style={[
            l.dock,
            compact && { paddingHorizontal: 14, paddingVertical: 10 },
          ]}
          testID="dock"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sigelt, volver al inicio"
            onPress={() => goTo("inicio")}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            {compact ? (
              <Icon name="logo" color={colors.mint} size={26} />
            ) : (
              <Brand small={compact} />
            )}
          </Pressable>
          <View
            style={[
              s.row,
              {
                gap: 5,
                display: tablet ? "none" : "flex",
              },
            ]}
          >
            {navigation.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Ir a ${item.label}`}
                accessibilityState={{ selected: active === item.id }}
                onPress={() => goTo(item.id)}
                testID="nav-item"
                style={[
                  l.navItem,
                  active === item.id && l.navActive,
                  compact && { paddingHorizontal: 10, gap: 0 },
                ]}
              >
                {!compact && (
                  <Icon
                    name={item.icon}
                    color={active === item.id ? colors.mint : colors.muted}
                    size={16}
                  />
                )}
                <Copy
                  style={{
                    fontSize: compact ? 12 : 13,
                    color: active === item.id ? colors.text : colors.muted,
                  }}
                >
                  {item.label}
                </Copy>
              </Pressable>
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: compact ? 8 : 16,
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/auth",
                  params: { mode: "login" },
                })
              }
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: "center",
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Copy
                style={{
                  color: colors.text,
                  fontSize: compact ? 12 : 14,
                }}
              >
                Iniciar sesión
              </Copy>
            </Pressable>

            <Action
              small
              onPress={() =>
                router.push({
                  pathname: "/auth",
                  params: { mode: "signup" },
                })
              }
              style={{
                paddingHorizontal: compact ? 10 : 17,
              }}
            >
              Crear cuenta
            </Action>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scroller}
        nativeID="sigelt-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={l.scrollContent}
        scrollEventThrottle={100}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y + (compact ? 160 : 230);
          setActive(
            y >= positions.current.informes && positions.current.informes > 0
              ? "informes"
              : y >= positions.current.producto &&
                  positions.current.producto > 0
                ? "producto"
                : "inicio",
          );
        }}
      >
        <View
          onLayout={(event) => register("inicio", event.nativeEvent.layout.y)}
          style={[l.section, l.hero, compact && l.heroMobile]}
        >
          <View
            style={[
              l.heroGrid,
              tablet && { gap: 20 },
              compact && { flexDirection: "column", gap: 16 },
            ]}
          >
            <View style={[l.heroCopy, compact && { width: "100%" }]}>
              <View style={[s.row, { marginBottom: 26, gap: 8 }]}>
                <View style={l.smallDot} />
                <Copy
                  style={{ fontSize: 11, color: "#c1ccc1", letterSpacing: 2 }}
                >
                  CADA COSA EN SU LUGAR
                </Copy>
              </View>
              <Copy
                accessibilityRole="header"
                headingLevel={1}
                style={[
                  l.heroTitle,
                  tablet && { fontSize: 67, lineHeight: 73 },
                  compact && {
                    fontSize: 54,
                    lineHeight: 59,
                    letterSpacing: -2.7,
                  },
                ]}
              >
                Tu inventario,{"\n"}
                <Copy
                  style={[
                    l.heroTitle,
                    { color: colors.mint },
                    tablet && { fontSize: 67, lineHeight: 73 },
                    compact && {
                      fontSize: 54,
                      lineHeight: 59,
                      letterSpacing: -2.7,
                    },
                  ]}
                >
                  en orden.
                </Copy>
              </Copy>
              <Copy
                style={[
                  s.muted,
                  {
                    maxWidth: 400,
                    marginTop: 26,
                    fontSize: 17,
                    lineHeight: 29,
                  },
                ]}
              >
                Organiza tus productos, registra entradas y ventas y consulta
                tus existencias en un mismo lugar. Más claridad en cada
                movimiento.
              </Copy>
              <View
                style={[s.row, { marginTop: 32, flexWrap: "wrap", gap: 20 }]}
              >
                <Action onPress={() => goTo("producto")}>
                  Explorar la demo
                </Action>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => goTo("conexion")}
                  style={[s.row, { minHeight: 46 }]}
                >
                  <Copy style={{ fontSize: 14, color: "#c5cec5" }}>
                    Así funciona
                  </Copy>
                  <Icon name="down" size={16} />
                </Pressable>
              </View>
              <View style={[s.row, { marginTop: 22 }]}>
                <Icon name="monitor" size={14} />
                <Copy style={{ color: colors.muted, fontSize: 12 }}>
                  Desde tu navegador. Sin instalaciones.
                </Copy>
              </View>
            </View>
            <HeroArtwork compact={compact} />
          </View>
          <View style={[l.heroBottom, compact && { marginTop: 45, gap: 14 }]}>
            <Copy style={l.smallLabel}>
              TUS PRODUCTOS. CADA MOVIMIENTO. TODO CONECTADO
            </Copy>
            <View style={[s.row, { gap: compact ? 16 : 30, flexWrap: "wrap" }]}>
              {[
                { icon: "box", label: "Organiza" },
                { icon: "receipt", label: "Registra" },
                { icon: "spark", label: "Comprende" },
              ].map((item) => (
                <View key={item.label} style={s.row}>
                  <Icon name={item.icon as IconName} size={17} />
                  <Copy style={{ color: "#bdc6bd", fontSize: 13 }}>
                    {item.label}
                  </Copy>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View
          onLayout={(event) => register("producto", event.nativeEvent.layout.y)}
          style={[l.section, l.productSection, compact && l.sectionMobile]}
        >
          <View
            testID="reveal"
            style={[
              l.sectionIntro,
              compact && {
                flexDirection: "column",
                gap: 18,
                alignItems: "stretch",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Eyebrow>01 / TU ESPACIO DE TRABAJO</Eyebrow>
              <SectionTitle compact={compact}>
                Todo a la vista.{"\n"}
                <Copy
                  style={[
                    l.headingMuted,
                    compact && { fontSize: 36, lineHeight: 42 },
                  ]}
                >
                  Todo bajo control.
                </Copy>
              </SectionTitle>
            </View>
            <Copy style={[s.muted, { maxWidth: 330 }]}>
              Encuentra un producto, revisa una venta o consulta el mes. Explora
              cómo se sentirá trabajar con Sigelt.
            </Copy>
          </View>
          <View testID="reveal">
            <ProductDemo compact={compact} tab={demoTab} setTab={setDemoTab} />
          </View>
          <View
            style={[
              l.demoCaption,
              compact && { flexDirection: "column", gap: 12 },
            ]}
          >
            <View style={s.row}>
              <View style={l.captionLine} />
              <Copy style={{ fontSize: 12, color: "#bac5b9" }}>
                Prueba las pestañas, el buscador y el filtro.
              </Copy>
            </View>
          </View>
        </View>

        <View
          style={[l.section, l.benefits, compact && l.sectionMobile]}
          testID="reveal"
        >
          <View
            style={[
              l.benefitRow,
              compact && { flexDirection: "column", gap: 35 },
            ]}
          >
            <View style={l.benefitCopy}>
              <Eyebrow>02 / MENOS FRICCIÓN, CADA DÍA</Eyebrow>
              <SectionTitle compact={compact}>
                Que no te falte{"\n"}lo importante.
              </SectionTitle>
              <Copy style={[s.muted, { marginTop: 22, maxWidth: 370 }]}>
                Consulta las existencias de cada producto e identifica cuáles
                necesitan reposición.
              </Copy>
              <View style={[s.row, { marginTop: 26 }]}>
                <Icon name="check" color={colors.mint} size={17} />
                <Copy style={{ fontSize: 14, color: "#cbd5c9" }}>
                  Un lugar para cada producto.
                </Copy>
              </View>
            </View>
            <View
              style={[l.stockVisual, compact && { width: "100%" }]}
              testID="stock-visual"
            >
              <View style={l.spread}>
                <View style={s.row}>
                  <Icon name="box" color={colors.mint} />
                  <Copy style={{ fontSize: 14 }}>Atención al inventario</Copy>
                </View>
                <Badge>Ejemplo</Badge>
              </View>
              <View style={l.stockAmount}>
                <Copy
                  style={{
                    fontSize: 70,
                    lineHeight: 80,
                    letterSpacing: -4,
                    fontWeight: "400",
                  }}
                >
                  {lowStock[0].stock}
                  <Copy style={{ color: colors.muted, fontSize: 18 }}>
                    {" "}
                    und.
                  </Copy>
                </Copy>
                <Badge mint>Por reponer</Badge>
              </View>
              <Copy style={{ fontSize: 20, letterSpacing: -0.5 }}>
                Marcador permanente
              </Copy>
              <Copy style={[s.muted, { fontSize: 13, marginTop: 7 }]}>
                Mínimo definido: {lowStock[0].minimum} unidades
              </Copy>
              <View style={l.stockBar}>
                {Array.from({ length: 16 }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 30,
                      borderRadius: 3,
                      backgroundColor: i < 8 ? "#a6dca0" : "#2a3429",
                      opacity: i < 8 ? 0.55 + i * 0.06 : 1,
                    }}
                  />
                ))}
              </View>
              <Copy
                style={{ color: colors.muted, fontSize: 12, marginTop: 16 }}
              >
                Una señal clara para revisar tus existencias.
              </Copy>
            </View>
          </View>
          <View
            style={[
              l.saleBenefit,
              compact && { flexDirection: "column", gap: 20 },
            ]}
          >
            <View style={l.roundIcon}>
              <Icon name="receipt" color={colors.mint} size={25} />
            </View>
            <View style={{ flex: 1 }}>
              <Copy
                accessibilityRole="header"
                style={{ fontSize: 24, lineHeight: 32, letterSpacing: -0.7 }}
              >
                Una venta. Cada detalle en su lugar.
              </Copy>
              <Copy style={[s.muted, { marginTop: 8, maxWidth: 650 }]}>
                Fecha, hora, productos, cantidades y precios. El flujo previsto
                valida el inventario antes de confirmar y descuenta las unidades
                vendidas.
              </Copy>
            </View>
            <View style={s.row}>
              <Icon name="check" color={colors.mint} size={16} />
              <Copy style={{ color: "#bdc8bb", fontSize: 12 }}>
                Sin vender lo que no hay
              </Copy>
            </View>
          </View>
        </View>

        <View
          onLayout={(event) => register("informes", event.nativeEvent.layout.y)}
          style={[l.section, l.reportSection, compact && l.sectionMobile]}
        >
          <View
            testID="reveal"
            style={[
              l.reportGrid,
              compact && { flexDirection: "column", gap: 35 },
            ]}
          >
            <View
              style={[l.reportVisual, compact && { width: "100%" }]}
              testID="report-visual"
            >
              <View style={l.spread}>
                <View style={s.row}>
                  <Icon name="spark" color={colors.mint} />
                  <Copy style={{ fontSize: 14 }}>Tu mes, explicado</Copy>
                </View>
                <Badge>Ejemplo</Badge>
              </View>
              <Copy
                style={{ color: colors.muted, marginTop: 24, fontSize: 12 }}
              >
                SEPTIEMBRE DE 2026
              </Copy>
              <Copy
                style={{
                  fontSize: 24,
                  lineHeight: 33,
                  letterSpacing: -0.6,
                  marginTop: 9,
                }}
              >
                De los movimientos{"\n"}a una lectura más clara.
              </Copy>
              <View style={{ marginTop: 24, gap: 16 }}>
                <View style={s.row}>
                  <View style={l.bullet} />
                  <Copy style={{ fontSize: 14, color: "#c9d3c7" }}>
                    Qué productos se vendieron más.
                  </Copy>
                </View>
                <View style={s.row}>
                  <View style={l.bullet} />
                  <Copy style={{ fontSize: 14, color: "#c9d3c7" }}>
                    Qué cambió frente al mes anterior.
                  </Copy>
                </View>
                <View style={s.row}>
                  <View style={l.bullet} />
                  <Copy style={{ fontSize: 14, color: "#c9d3c7" }}>
                    Qué existencias conviene revisar.
                  </Copy>
                </View>
              </View>
              <View style={l.reportFoot}>
                <Icon name="check" size={16} color={colors.mint} />
                <Copy style={{ fontSize: 12, color: colors.muted, flex: 1 }}>
                  Cada explicación parte de un dato.
                </Copy>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow>03 / CLARIDAD, CON AYUDA DE IA</Eyebrow>
              <SectionTitle compact={compact}>
                Tus datos hablan.{"\n"}
                <Copy
                  style={[
                    l.headingMuted,
                    compact && { fontSize: 36, lineHeight: 42 },
                  ]}
                >
                  Entiéndelos mejor.
                </Copy>
              </SectionTitle>
              <Copy style={[s.muted, { marginTop: 24 }]}>
                El sistema calcula los indicadores. El asistente los convierte
                en un informe mensual fácil de comprender.
              </Copy>
              <Copy style={[s.muted, { marginTop: 15 }]}>
                Resúmenes, productos más y menos vendidos, comparaciones cuando
                hay datos suficientes y alertas de existencias. Recomendaciones
                sustentadas, sin inventar causas.
              </Copy>
              <View style={{ marginTop: 26 }}>
                <Action
                  secondary
                  onPress={() => {
                    setDemoTab("report");
                    goTo("producto");
                  }}
                >
                  Conocer la vista de informes
                </Action>
              </View>
            </View>
          </View>
        </View>

        <View
          onLayout={(event) => register("conexion", event.nativeEvent.layout.y)}
          style={[l.section, l.connection, compact && l.sectionMobile]}
        >
          <View testID="reveal" style={{ alignItems: "center" }}>
            <Eyebrow>04 / UN SOLO FLUJO</Eyebrow>
            <View style={{ maxWidth: 650, alignItems: "center" }}>
              <SectionTitle compact={compact}>
                Todo empieza a conectar.
              </SectionTitle>
              <Copy
                style={[
                  s.muted,
                  { textAlign: "center", marginTop: 18, maxWidth: 530 },
                ]}
              >
                Desde el primer producto hasta el informe del mes. Cuatro
                módulos que comparten la misma información.
              </Copy>
            </View>
          </View>
          <View
            testID="reveal"
            style={[l.moduleScene, compact && { height: 350 }]}
          >
            <View testID="module-halo" style={l.moduleHalo} />
            <View
              style={[l.orbitRing, compact && { width: 290, height: 200 }]}
            />
            <View
              style={[
                l.orbitRingOuter,
                compact && { width: "100%", height: 280 },
              ]}
            />
            <View style={l.horizontalLine} />
            <View style={l.verticalLine} />
            <View
              style={[l.core, compact && { width: 100, height: 100 }]}
              testID="module-core"
            >
              <Icon name="logo" size={45} color={colors.mint} />
              <Copy style={{ fontSize: 14, marginTop: 8, fontWeight: "500" }}>
                sigelt.
              </Copy>
            </View>
            {modules.map((item, i) => (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                accessibilityState={{ selected: i === module }}
                accessibilityLabel={`Conocer módulo ${item.name}`}
                onPress={() => setModule(i)}
                testID="module-button"
                style={[
                  l.module,
                  i === 0
                    ? { left: compact ? 0 : "12%", top: "42%" }
                    : i === 1
                      ? { top: compact ? 15 : 20, left: "50%", marginLeft: -70 }
                      : i === 2
                        ? { right: compact ? 0 : "12%", top: "42%" }
                        : {
                            bottom: compact ? 12 : 20,
                            left: "50%",
                            marginLeft: -70,
                          },
                  compact &&
                    (i === 0 || i === 2) && {
                      width: width < 360 ? 80 : 100,
                      paddingHorizontal: 8,
                      gap: 5,
                    },
                  i === module && l.moduleActive,
                ]}
              >
                <Icon
                  name={item.icon}
                  size={22}
                  color={i === module ? colors.mint : colors.muted}
                />
                <Copy
                  style={{
                    fontSize: compact ? 12 : 14,
                    color: i === module ? colors.text : "#a4afa4",
                  }}
                >
                  {item.name}
                </Copy>
              </Pressable>
            ))}
          </View>
          <View accessibilityLiveRegion="polite" style={l.moduleDescription}>
            <Copy
              style={{
                color: colors.mint,
                fontSize: 14,
                fontWeight: "500",
                textAlign: "center",
              }}
            >
              {modules[module].name}
            </Copy>
            <Copy
              style={[
                s.muted,
                { textAlign: "center", fontSize: 14, maxWidth: 570 },
              ]}
            >
              {modules[module].description}
            </Copy>
          </View>
        </View>

        <View
          style={[l.section, l.closing, compact && l.sectionMobile]}
          testID="reveal"
        >
          <View testID="closing-glow" style={l.closingGlow} />
          <View style={{ alignItems: "center", gap: 24 }}>
            <Icon name="logo" size={36} color={colors.mint} />
            <Copy
              accessibilityRole="header"
              style={{
                fontSize: compact ? 40 : 64,
                lineHeight: compact ? 46 : 72,
                fontWeight: "500",
                letterSpacing: -2.6,
                textAlign: "center",
              }}
            >
              Un poco más de orden.{"\n"}
              <Copy
                style={{
                  fontSize: compact ? 40 : 64,
                  lineHeight: compact ? 46 : 72,
                  fontWeight: "500",
                  letterSpacing: -2.6,
                  color: colors.mint,
                }}
              >
                Un día más simple.
              </Copy>
            </Copy>
            <Copy style={[s.muted, { textAlign: "center" }]}>
              Conoce el espacio que estamos creando para gestionar tus
              productos, inventario y ventas.
            </Copy>
            <Action
              onPress={() => goTo("producto")}
              style={{ alignSelf: "center" }}
            >
              Explorar la demo
            </Action>
            <Copy style={{ fontSize: 12, color: colors.muted }}>
              Sin registro · datos de demostración
            </Copy>
          </View>
        </View>
        <View
          style={[
            l.section,
            l.footer,
            compact && {
              flexDirection: "column",
              gap: 24,
              alignItems: "flex-start",
              paddingHorizontal: 24,
            },
          ]}
        >
          <View style={{ gap: 10 }}>
            <Brand small />
            <Copy style={{ color: colors.muted, fontSize: 12 }}>
              Un lugar para tenerlo claro.
            </Copy>
          </View>
          <Copy style={{ fontSize: 12, color: colors.muted, maxWidth: 350 }}>
            Sigelt · Gestión de productos, inventario y ventas en un solo lugar.
          </Copy>
          <Pressable
            accessibilityRole="button"
            onPress={() => goTo("inicio")}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Copy style={{ color: "#ced8cc", fontSize: 13 }}>
              Volver arriba ↑
            </Copy>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const l = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { alignItems: "center", paddingBottom: 24 },
  headerWrap: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    alignItems: "center",
    zIndex: 100,
  },
  dock: {
    width: "100%",
    maxWidth: 1060,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#343a33",
    backgroundColor: "#171c18f2",
  },
  navItem: {
    minHeight: 44,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 99,
  },
  navActive: { backgroundColor: "#2c352b" },
  section: { width: "100%", maxWidth: 1180, paddingHorizontal: 40 },
  sectionMobile: { paddingHorizontal: 24, paddingTop: 65, paddingBottom: 65 },
  hero: { paddingTop: 190, paddingBottom: 35 },
  heroMobile: { paddingTop: 137, paddingHorizontal: 24 },
  heroGrid: {
    flexDirection: "row",
    gap: 32,
    alignItems: "center",
    minHeight: 455,
  },
  heroCopy: { width: "48%", zIndex: 2 },
  heroTitle: {
    fontSize: 80,
    lineHeight: 86,
    letterSpacing: -4.5,
    fontWeight: "500",
  },
  smallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mint,
  },
  art: { width: "48%", height: 490, position: "relative", minWidth: 0 },
  artCompact: {
    width: "100%",
    height: 425,
    minHeight: 425,
    flexShrink: 0,
    marginTop: 24,
  },
  halo: {
    position: "absolute",
    top: 20,
    left: -40,
    width: "110%",
    height: 410,
    borderRadius: 240,
    backgroundColor: "#142112",
    opacity: 0.5,
  },
  heroOrbit: {
    position: "absolute",
    top: 26,
    left: -22,
    width: "103%",
    height: 425,
    borderWidth: 1,
    borderColor: "#233221",
    borderRadius: 240,
    transform: [{ rotate: "-24deg" }],
  },
  notebook: {
    position: "absolute",
    top: 4,
    right: 20,
    width: 180,
    height: 240,
    backgroundColor: "#34442c",
    borderWidth: 1,
    borderColor: "#6f8560",
    borderRadius: 12,
    transform: [{ rotate: "16deg" }],
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    zIndex: 1,
  },
  spine: {
    position: "absolute",
    left: 11,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#789368",
  },
  notebookLine: {
    width: 70,
    height: 1,
    backgroundColor: "#708762",
    marginTop: 10,
  },
  heroCard: {
    position: "absolute",
    left: -2,
    top: 130,
    width: "91%",
    padding: 24,
    backgroundColor: "#171e18",
    borderWidth: 1,
    borderColor: "#45513d",
    borderRadius: 17,
    transform: [{ rotate: "-6deg" }],
    zIndex: 2,
  },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.mint,
    borderRadius: 4,
  },
  floatingNote: {
    position: "absolute",
    bottom: 8,
    right: -10,
    borderWidth: 1,
    borderColor: "#40543a",
    backgroundColor: "#202a1fee",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 3,
  },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#507548",
    backgroundColor: "#344a2b",
    alignItems: "center",
    justifyContent: "center",
  },
  annotation: { position: "absolute", left: 0, top: 65, gap: 10, zIndex: 2 },
  annotationLine: { width: 40, height: 1, backgroundColor: "#698061" },
  heroBottom: {
    marginTop: 75,
    paddingVertical: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#252e26",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 20,
  },
  smallLabel: { color: "#8e9a90", fontSize: 10, letterSpacing: 1.5 },
  productSection: { paddingTop: 90, paddingBottom: 65 },
  sectionIntro: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 70,
    marginBottom: 40,
  },
  headingMuted: {
    color: "#869783",
    fontSize: 48,
    lineHeight: 55,
    letterSpacing: -1.9,
    fontWeight: "500",
  },
  demoCaption: {
    marginTop: 23,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  captionLine: { width: 28, height: 1, backgroundColor: "#6d8264" },
  benefits: { paddingTop: 95, paddingBottom: 65 },
  benefitRow: { flexDirection: "row", gap: 100, alignItems: "center" },
  benefitCopy: { flex: 1 },
  stockVisual: {
    width: "45%",
    padding: 30,
    backgroundColor: "#131a13",
    borderWidth: 1,
    borderColor: "#303e2d",
    borderRadius: 18,
  },
  stockAmount: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 14,
  },
  stockBar: { flexDirection: "row", gap: 5, marginTop: 25 },
  saleBenefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 25,
    paddingVertical: 40,
    marginTop: 60,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  roundIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1a2419",
    borderWidth: 1,
    borderColor: "#354331",
    alignItems: "center",
    justifyContent: "center",
  },
  reportSection: { paddingTop: 70, paddingBottom: 95 },
  reportGrid: { flexDirection: "row", alignItems: "center", gap: 85 },
  reportVisual: {
    width: "46%",
    backgroundColor: "#151b15",
    borderWidth: 1,
    borderColor: "#34432e",
    borderRadius: 18,
    padding: 30,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.mint,
  },
  reportFoot: {
    paddingTop: 20,
    marginTop: 28,
    borderTopWidth: 1,
    borderColor: "#34432e",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  connection: {
    paddingTop: 90,
    paddingBottom: 100,
    borderTopWidth: 1,
    borderColor: "#222c23",
  },
  moduleScene: {
    width: "100%",
    maxWidth: 780,
    alignSelf: "center",
    height: 400,
    marginTop: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleHalo: {
    position: "absolute",
    width: 320,
    height: 300,
    borderRadius: 200,
    backgroundColor: "#152512",
    opacity: 0.8,
  },
  orbitRing: {
    position: "absolute",
    width: 420,
    height: 250,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: "#2b3b27",
  },
  orbitRingOuter: {
    position: "absolute",
    width: 590,
    height: 340,
    borderRadius: 300,
    borderWidth: 1,
    borderColor: "#1c281b",
  },
  horizontalLine: {
    position: "absolute",
    width: "70%",
    height: 1,
    backgroundColor: "#344d2c",
  },
  verticalLine: {
    position: "absolute",
    height: 300,
    width: 1,
    backgroundColor: "#344d2c",
  },
  core: {
    width: 130,
    height: 130,
    backgroundColor: "#111a10",
    borderWidth: 1,
    borderColor: "#90b27b",
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  module: {
    position: "absolute",
    width: 140,
    paddingHorizontal: 17,
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#2f392f",
    backgroundColor: "#131913",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 3,
  },
  moduleActive: { borderColor: "#5c7b51", backgroundColor: "#233020" },
  moduleDescription: { alignItems: "center", gap: 7, minHeight: 85 },
  closing: {
    paddingTop: 90,
    paddingBottom: 95,
    borderTopWidth: 1,
    borderColor: "#2a3528",
    position: "relative",
    overflow: "hidden",
  },
  closingGlow: {
    position: "absolute",
    top: 0,
    left: "10%",
    right: "10%",
    height: 350,
    backgroundColor: "#142212",
    opacity: 0.3,
    borderRadius: 500,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 40,
    paddingBottom: 20,
  },
});
