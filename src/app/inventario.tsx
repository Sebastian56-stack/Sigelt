import { InventoryIntelligencePanel } from "@/components/sigelt/inventory-intelligence";
import { MonthlyReportPanel } from "@/components/sigelt/monthly-report";
import { SalesCart } from "@/components/sigelt/sales-cart";
import { Ionicons } from "@expo/vector-icons";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand, colors } from "@/components/sigelt/primitives";

import { InventoryAccessGate } from "@/components/sigelt/inventory-access-gate";
import { InventoryUsersPanel } from "@/components/sigelt/inventory-users-panel";
import {
  ProductCreateModal,
  ProductEditModal,
  StockEntryModal,
  formatCOP,
} from "@/components/sigelt/product-forms";
import type {
  ActiveInventoryAccess,
  InventoryRole,
} from "@/lib/inventory-users";
import {
  getProducts,
  getStockMovements,
  type Product,
  type StockMovement,
} from "@/lib/products";
import { supabase } from "@/lib/supabase";

// ======================================================
// CONFIGURACIÓN VISUAL
// ======================================================

const theme = {
  bg: colors.bg,
  panel: colors.panel,
  border: colors.border,
  mint: colors.mint,
  muted: colors.muted,
  text: "#F5F7F5",
  surface: "#141C17",
  surfaceHover: "#1C2A20",
  secondary: "#A9B9AD",
  darkText: "#09110B",
};

type Section =
  | "Inventario"
  | "Movimientos"
  | "Ventas"
  | "Informe mensual"
  | "Usuarios"
  | "Inteligencia";

type IconName = ComponentProps<typeof Ionicons>["name"];

const navigation: {
  title: Section;
  icon: IconName;
}[] = [
  { title: "Inventario", icon: "cube-outline" },
  { title: "Movimientos", icon: "swap-horizontal-outline" },
  { title: "Ventas", icon: "receipt-outline" },
  { title: "Informe mensual", icon: "stats-chart-outline" },
  { title: "Inteligencia", icon: "sparkles-outline" },
  { title: "Usuarios", icon: "people-outline" },
];

// ======================================================
// COMPONENTE DE NAVEGACIÓN
// ======================================================

function Sidebar({
  active,
  role,
  inventoryName,
  onNavigate,
}: {
  active: Section;
  role: InventoryRole;
  inventoryName: string | null;
  onNavigate: (section: Section) => void;
}) {
  return (
    <View style={styles.sidebar}>
      <View>
        <Text style={styles.sidebarLabel}>
          {role === "admin" ? "ADMINISTRACIÓN" : "VENTAS"}
        </Text>

        {navigation
          .filter((item) => role === "admin" || item.title === "Ventas")
          .map((item) => {
            const selected = active === item.title;

            return (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onNavigate(item.title)}
                style={({ pressed }) => [
                  styles.navItem,
                  selected && styles.navItemActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={19}
                  color={selected ? theme.mint : theme.secondary}
                />

                <Text
                  style={[styles.navText, selected && styles.navTextActive]}
                >
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
      </View>

      <View style={styles.sidebarFooter}>
        <Ionicons name="desktop-outline" size={22} color={theme.secondary} />

        <Text style={styles.footerText}>
          {inventoryName
            ? "Tu espacio de trabajo está preparado."
            : "Aquí comenzará tu espacio de trabajo."}
        </Text>

        <View style={styles.footerDivider} />

        <Text style={styles.footerCurrency}>Moneda: COP</Text>
      </View>
    </View>
  );
}

// ======================================================
// COMPONENTE DE INDICADORES
// ======================================================

function StatCard({
  label,
  description,
  value,
  icon,
}: {
  label: string;
  description: string;
  value: string;
  icon: IconName;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel}>{label}</Text>
        <Ionicons name={icon} size={17} color={theme.secondary} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statDescription}>{description}</Text>
    </View>
  );
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function InventarioScreen() {
  return (
    <InventoryAccessGate>
      {(user, access) => (
        <InventoryWorkspace
          key={user.id + ":" + access.inventory_id + ":" + access.role}
          user={user}
          access={access}
        />
      )}
    </InventoryAccessGate>
  );
}

function InventoryWorkspace({
  user,
  access,
}: {
  user: User;
  access: ActiveInventoryAccess;
}) {
  const isAdmin = access.role === "admin";
  const inventory = { id: access.inventory_id, name: access.inventory_name };
  const inventoryName = inventory.name;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 850;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [section, setSection] = useState<Section>(
    isAdmin ? "Inventario" : "Ventas",
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // Productos reales, inventario y entradas.
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [productsReload, setProductsReload] = useState(0);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsReload, setMovementsReload] = useState(0);
  const [movementsError, setMovementsError] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [preferredEntryId, setPreferredEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");

  const productCount = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const lowStock = products.filter(
    (p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock,
  ).length;
  const outOfStock = products.filter((p) => p.stock_quantity === 0).length;
  const visibleProducts = products.filter((p) => {
    const term = search.trim().toLocaleLowerCase();
    const matchesText = `${p.name} ${p.code} ${p.category}`
      .toLocaleLowerCase()
      .includes(term);
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "low" &&
        p.stock_quantity > 0 &&
        p.stock_quantity <= p.min_stock) ||
      (stockFilter === "out" && p.stock_quantity === 0);
    return matchesText && matchesStock;
  });

  // Consultar catálogo del inventario autenticado.
  useEffect(() => {
    let alive = true;

    void getProducts(inventory.id)
      .then((data) => {
        if (alive) {
          setProducts(data);
          setProductsError("");
        }
      })
      .catch((err) => {
        console.error("Error cargando productos:", err);
        if (alive) {
          setProducts([]);
          setProductsError("No se pudieron cargar los productos.");
        }
      })
      .finally(() => {
        if (alive) setProductsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [inventory?.id, productsReload]);

  useEffect(() => {
    let alive = true;
    if (!inventory.id || !isAdmin)
      return () => {
        alive = false;
      };

    void getStockMovements(inventory.id)
      .then((rows) => {
        if (alive) {
          setMovements(rows);
          setMovementsError("");
        }
      })
      .catch((err) => {
        console.error("Error cargando movimientos:", err);
        if (alive)
          setMovementsError("No se pudo cargar el historial de movimientos.");
      });

    return () => {
      alive = false;
    };
  }, [inventory.id, movementsReload, isAdmin]);

  function openStockEntry(productId: string | null = null) {
    if (!isAdmin || products.length === 0) return;
    setPreferredEntryId(productId);
    setEntryModalOpen(true);
  }

  function onProductSaved(product: Product) {
    setProducts((current) => [
      product,
      ...current.filter((item) => item.id !== product.id),
    ]);
    setProductModalOpen(false);
    setSearch("");
    setStockFilter("all");
  }

  function onProductUpdated(updatedProduct: Product) {
    setProducts((current) =>
      current.map((product) =>
        product.id === updatedProduct.id ? updatedProduct : product,
      ),
    );

    setEditingProduct(null);
  }

  function onEntrySaved(productId: string, newStock: number) {
    setProducts((current) =>
      current.map((p) =>
        p.id === productId ? { ...p, stock_quantity: newStock } : p,
      ),
    );
    setEntryModalOpen(false);
    setPreferredEntryId(null);
    // Lectura fresca para reflejar también operaciones desde otra sesión.
    setProductsLoading(true);
    setProductsReload((n) => n + 1);
    setMovementsReload((n) => n + 1);
  }

  // ------------------------------------------------------
  // CERRAR SESIÓN
  // ------------------------------------------------------

  async function logout() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (signOutError) {
        setError("No pudimos cerrar la sesión. Inténtalo de nuevo.");
      }
    } catch {
      setError("Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------
  // NAVEGACIÓN
  // ------------------------------------------------------

  function navigateTo(nextSection: Section) {
    if (!isAdmin && nextSection !== "Ventas") return;
    setSection(nextSection);
    setMenuOpen(false);
  }

  // ======================================================
  // INTERFAZ
  // ======================================================

  return (
    <View style={styles.app}>
      {/* ============================================= */}
      {/* BARRA SUPERIOR */}
      {/* ============================================= */}

      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          {!isDesktop && (
            <Pressable
              accessibilityLabel="Abrir menú"
              accessibilityRole="button"
              onPress={() => setMenuOpen(true)}
              style={styles.iconButton}
            >
              <Ionicons name="menu-outline" size={25} color={theme.text} />
            </Pressable>
          )}

          <Brand />

          {isDesktop && <View style={styles.brandSeparator} />}

          {isDesktop && (
            <Text style={styles.workspaceName} numberOfLines={1}>
              {inventoryName ?? "Mi espacio de trabajo"}
            </Text>
          )}
        </View>

        <View style={styles.topbarRight}>
          {isDesktop && (
            <View style={styles.phaseBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.phaseText}>
                {isAdmin ? "Administrador" : "Vendedor"}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void logout()}
            style={({ pressed }) => [
              styles.logoutButton,
              (pressed || busy) && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={theme.secondary}
            />

            {isDesktop && (
              <Text style={styles.logoutText}>
                {busy ? "Cerrando..." : "Salir"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ============================================= */}
      {/* CONTENEDOR PRINCIPAL */}
      {/* ============================================= */}

      <View style={styles.body}>
        {/* Menú lateral en computador */}

        {isDesktop && (
          <View style={styles.desktopSidebar}>
            <Sidebar
              active={section}
              role={access.role}
              inventoryName={inventoryName}
              onNavigate={navigateTo}
            />
          </View>
        )}

        {/* Contenido */}

        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={[
            styles.mainScrollContent,
            isDesktop ? styles.mainDesktop : styles.mainMobile,
          ]}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mainInner}>
            {!!error && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle-outline"
                  size={19}
                  color="#FF9E9E"
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* ===================================== */}
            {/* SECCIÓN INVENTARIO */}
            {/* ===================================== */}

            {isAdmin && section === "Inventario" && (
              <>
                <>
                  <View style={styles.inventoryHeading}>
                    <View style={styles.headingTextContainer}>
                      <Text style={styles.pageTitle}>Todo en su lugar.</Text>

                      <Text style={styles.pageSubtitle}>{inventoryName}</Text>

                      <Text style={styles.smallHint}>
                        Tu espacio está preparado para gestionar productos.
                      </Text>
                    </View>

                    <View style={styles.headingIcon}>
                      <Ionicons
                        name="cube-outline"
                        size={26}
                        color={theme.mint}
                      />
                    </View>
                  </View>

                  {/* INDICADORES */}

                  <View style={styles.statsGrid}>
                    <StatCard
                      label="Productos"
                      value={String(productCount)}
                      description="En el catálogo"
                      icon="cube-outline"
                    />

                    <StatCard
                      label="Existencias"
                      value={String(totalStock)}
                      description="Unidades disponibles"
                      icon="layers-outline"
                    />

                    <StatCard
                      label="Existencias bajas"
                      value={String(lowStock)}
                      description="Por revisar"
                      icon="alert-circle-outline"
                    />

                    <StatCard
                      label="Agotados"
                      value={String(outOfStock)}
                      description="Sin unidades"
                      icon="close-circle-outline"
                    />
                  </View>

                  {/* ACCIONES DEL INVENTARIO */}

                  <View style={styles.inventoryToolbar}>
                    <View style={styles.searchBox}>
                      <Ionicons
                        name="search-outline"
                        size={20}
                        color={theme.muted}
                      />

                      <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar por nombre, código o categoría..."
                        placeholderTextColor={theme.muted}
                        style={styles.searchInput}
                        accessibilityLabel="Buscar productos"
                      />
                    </View>

                    <View style={styles.toolbarActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: productCount === 0 }}
                        disabled={productCount === 0}
                        onPress={() => openStockEntry()}
                        style={({ pressed }) => [
                          styles.actionOutline,
                          (pressed || productCount === 0) && {
                            opacity: 0.55,
                          },
                        ]}
                      >
                        <Ionicons
                          name="download-outline"
                          size={18}
                          color={theme.secondary}
                        />
                        <Text style={styles.actionOutlineText}>
                          Registrar entrada
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setProductModalOpen(true)}
                        style={({ pressed }) => [
                          styles.actionPrimary,
                          pressed && { opacity: 0.78 },
                        ]}
                      >
                        <Ionicons
                          name="add-outline"
                          size={20}
                          color={theme.darkText}
                        />
                        <Text style={styles.actionPrimaryText}>
                          Nuevo producto
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* FILTROS DE EXISTENCIAS */}
                  <View style={styles.stockFilters}>
                    {(
                      [
                        ["all", "Todos"],
                        ["low", `Por reponer (${lowStock})`],
                        ["out", `Agotados (${outOfStock})`],
                      ] as const
                    ).map(([filter, label]) => (
                      <Pressable
                        key={filter}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: stockFilter === filter,
                        }}
                        onPress={() => setStockFilter(filter)}
                        style={[
                          styles.filterPill,
                          stockFilter === filter && styles.filterPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterPillText,
                            stockFilter === filter &&
                              styles.filterPillTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* LISTADO DE PRODUCTOS */}
                  <View style={styles.productPanel}>
                    {isDesktop && (
                      <View style={styles.tableHeader}>
                        <Text style={styles.columnProduct}>PRODUCTO</Text>
                        <Text style={styles.columnPrice}>PRECIO / UND.</Text>
                        <Text style={styles.columnStock}>EXISTENCIAS</Text>
                      </View>
                    )}

                    {productsLoading ? (
                      <View style={styles.emptyProducts}>
                        <ActivityIndicator color={theme.mint} />
                        <Text style={styles.emptyDescription}>
                          Cargando productos...
                        </Text>
                      </View>
                    ) : productsError ? (
                      <View style={styles.emptyProducts}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={28}
                          color="#FFAAAA"
                        />
                        <Text style={styles.emptyDescription}>
                          {productsError}
                        </Text>
                        <Pressable
                          onPress={() => setProductsReload((n) => n + 1)}
                          style={styles.retryButton}
                        >
                          <Text style={{ color: theme.mint }}>Reintentar</Text>
                        </Pressable>
                      </View>
                    ) : visibleProducts.length === 0 ? (
                      <View style={styles.emptyProducts}>
                        <View style={styles.emptyIcon}>
                          <Ionicons
                            name="file-tray-outline"
                            size={30}
                            color={theme.secondary}
                          />
                        </View>
                        <Text style={styles.emptyTitle}>
                          {productCount === 0
                            ? "Todavía no hay productos."
                            : "No encontramos productos."}
                        </Text>
                        <Text style={styles.emptyDescription}>
                          {productCount === 0
                            ? "Pulsa «Nuevo producto» para agregar tu primer artículo al catálogo."
                            : "Prueba otra búsqueda o cambia el filtro."}
                        </Text>
                      </View>
                    ) : (
                      visibleProducts.map((product) => {
                        const out = product.stock_quantity === 0;
                        const low =
                          !out && product.stock_quantity <= product.min_stock;
                        return (
                          <Pressable
                            key={product.id}
                            onPress={() => setSelectedProduct(product)}
                            accessibilityRole="button"
                            accessibilityLabel={`Ver detalles de ${product.name}`}
                            style={({ pressed }) => [
                              styles.productRow,
                              !isDesktop && styles.productRowMobile,
                              pressed && styles.productRowPressed,
                            ]}
                          >
                            <View
                              style={[
                                styles.productMain,
                                !isDesktop && styles.productMainMobile,
                              ]}
                            >
                              <View style={styles.productSymbol}>
                                <Ionicons
                                  name="cube-outline"
                                  size={20}
                                  color={theme.secondary}
                                />
                              </View>
                              <View style={styles.productTextWrap}>
                                <Text
                                  style={styles.productName}
                                  numberOfLines={1}
                                >
                                  {product.name}
                                </Text>
                                <Text
                                  style={styles.productMeta}
                                  numberOfLines={2}
                                >
                                  {product.code} · {product.category} ·{" "}
                                  {product.unit}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={
                                !isDesktop
                                  ? styles.mobileStockLine
                                  : styles.desktopValues
                              }
                            >
                              <View style={styles.priceColumn}>
                                <Text style={styles.productPrice}>
                                  {formatCOP(product.sale_price)}
                                </Text>
                              </View>
                              <View style={styles.stockColumn}>
                                <Text style={styles.stockNumber}>
                                  {product.stock_quantity} und.
                                </Text>
                                {(out || low) && (
                                  <Text
                                    style={[
                                      styles.stockStatus,
                                      out && styles.stockStatusOut,
                                    ]}
                                  >
                                    {out ? "Agotado" : "Por reponer"}
                                  </Text>
                                )}
                                <Text style={styles.stockAction}>
                                  Ver detalles
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                  <Text style={styles.inventoryFooter}>
                    {visibleProducts.length} de {productCount} productos ·{" "}
                    {totalStock} unidades
                  </Text>
                </>
              </>
            )}

            {/* ===================================== */}
            {/* HISTORIAL REAL DE ENTRADAS */}
            {/* ===================================== */}

            {isAdmin && section === "Movimientos" && (
              <>
                <View style={styles.pageHeading}>
                  <Text style={styles.pageTitle}>Movimientos</Text>
                  <Text style={styles.pageSubtitle}>
                    Historial de entradas registradas en el inventario.
                  </Text>
                </View>
                <View style={styles.productPanel}>
                  {movementsError ? (
                    <View style={styles.emptyProducts}>
                      <Text style={styles.emptyDescription}>
                        {movementsError}
                      </Text>
                      <Pressable
                        onPress={() => setMovementsReload((n) => n + 1)}
                        style={styles.retryButton}
                      >
                        <Text style={{ color: theme.mint }}>Reintentar</Text>
                      </Pressable>
                    </View>
                  ) : movements.length === 0 ? (
                    <View style={styles.emptyProducts}>
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={29}
                        color={theme.mint}
                      />
                      <Text style={styles.emptyTitle}>
                        Todavía no hay movimientos.
                      </Text>
                      <Text style={styles.emptyDescription}>
                        Cada entrada de mercancía quedará registrada aquí.
                      </Text>
                    </View>
                  ) : (
                    movements.map((movement) => {
                      const product = products.find(
                        (p) => p.id === movement.product_id,
                      );
                      return (
                        <View key={movement.id} style={styles.movementRow}>
                          <View style={styles.movementIcon}>
                            <Ionicons
                              name="arrow-down-outline"
                              size={20}
                              color={theme.mint}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.productName}>
                              {product?.name ?? "Producto"}
                            </Text>
                            <Text style={styles.productMeta}>
                              {new Date(movement.created_at).toLocaleString(
                                "es-CO",
                              )}
                              {movement.note ? ` · ${movement.note}` : ""}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text
                              style={[
                                styles.stockNumber,
                                { color: theme.mint },
                              ]}
                            >
                              {movement.quantity_change > 0 ? "+" : ""}
                              {movement.quantity_change}
                            </Text>
                            <Text style={styles.productMeta}>
                              Quedaron {movement.stock_after}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}

            {/* ===================================== */}
            {/* VENTAS - CARRITO DE COMPRAS */}
            {/* ===================================== */}

            {section === "Ventas" && !!productsError && (
              <View style={styles.errorBanner}>
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {productsError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setProductsReload((n) => n + 1)}
                  style={styles.retryButton}
                >
                  <Text style={{ color: theme.mint }}>Reintentar</Text>
                </Pressable>
              </View>
            )}
            {section === "Ventas" && inventory && (
              <SalesCart
                inventoryId={inventory.id}
                products={products}
                loading={productsLoading}
                onSaleConfirmed={() => {
                  setProductsLoading(true);
                  setProductsReload((n) => n + 1);
                  setMovementsReload((n) => n + 1);
                }}
              />
            )}

            {/* ===================================== */}
            {/* OTRAS SECCIONES: NAVEGACIÓN VISUAL */}
            {/* ===================================== */}

            {isAdmin && section === "Usuarios" && (
              <InventoryUsersPanel currentUserId={user.id} />
            )}

            {isAdmin && section === "Inteligencia" && (
              <InventoryIntelligencePanel />
            )}

            {isAdmin && section === "Informe mensual" && inventory && (
              <MonthlyReportPanel
                key={inventory.id}
                inventoryId={inventory.id}
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* ============================================= */}
      {/* MENÚ MÓVIL */}
      {/* ============================================= */}

      <Modal
        visible={!isDesktop && menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <SafeAreaView
          edges={
            Platform.OS === "web" ? [] : ["top", "bottom", "left", "right"]
          }
          style={styles.drawerLayout}
        >
          <View style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Menú</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar menú"
                onPress={() => setMenuOpen(false)}
                style={styles.iconButton}
              >
                <Ionicons name="close-outline" size={24} color={theme.text} />
              </Pressable>
            </View>

            <Sidebar
              active={section}
              role={access.role}
              inventoryName={inventoryName}
              onNavigate={navigateTo}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú"
            onPress={() => setMenuOpen(false)}
            style={styles.drawerBackdrop}
          />
        </SafeAreaView>
      </Modal>

      {/* DETALLE DEL PRODUCTO */}

      <Modal
        visible={isAdmin && selectedProduct !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Encabezado */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="cube-outline" size={24} color={theme.mint} />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar detalles"
                onPress={() => setSelectedProduct(null)}
                style={styles.iconButton}
              >
                <Ionicons
                  name="close-outline"
                  size={24}
                  color={theme.secondary}
                />
              </Pressable>
            </View>

            <Text style={styles.modalTitle}>{selectedProduct?.name ?? ""}</Text>

            <Text style={styles.modalDescription}>
              Información registrada del producto.
            </Text>

            <ScrollView style={{ maxHeight: 400 }}>
              {selectedProduct && (
                <View>
                  {[
                    ["Código", selectedProduct.code],
                    ["Categoría", selectedProduct.category],
                    ["Unidad de venta", selectedProduct.unit],
                    ["Precio de venta", formatCOP(selectedProduct.sale_price)],
                    [
                      "Existencias actuales",
                      String(selectedProduct.stock_quantity),
                    ],
                    ["Existencia mínima", String(selectedProduct.min_stock)],
                    [
                      "Descripción",
                      selectedProduct.description || "Sin descripción",
                    ],
                  ].map(([label, value]) => (
                    <View
                      key={label}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                      }}
                    >
                      <Text
                        style={{
                          color: theme.muted,
                          fontSize: 12,
                          marginBottom: 5,
                        }}
                      >
                        {label}
                      </Text>

                      <Text
                        style={{
                          color: theme.text,
                          fontSize: 14,
                          fontWeight: "500",
                        }}
                      >
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Acciones */}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedProduct(null)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cerrar</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (!selectedProduct) return;

                  const product = selectedProduct;

                  setSelectedProduct(null);
                  setEditingProduct(product);
                }}
                style={styles.cancelButton}
              >
                <Ionicons name="create-outline" size={18} color={theme.mint} />

                <Text style={styles.cancelButtonText}>Editar</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (!selectedProduct) return;

                  const productId = selectedProduct.id;

                  setSelectedProduct(null);
                  openStockEntry(productId);
                }}
                style={styles.confirmButton}
              >
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={theme.darkText}
                />

                <Text style={styles.confirmButtonText}>Registrar entrada</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {isAdmin && inventory && (
        <>
          <ProductCreateModal
            visible={productModalOpen}
            inventoryId={inventory.id}
            onClose={() => setProductModalOpen(false)}
            onSaved={onProductSaved}
          />

          <ProductEditModal
            visible={editingProduct !== null}
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSaved={onProductUpdated}
          />

          <StockEntryModal
            visible={entryModalOpen}
            products={products}
            preferredProductId={preferredEntryId}
            onClose={() => {
              setEntryModalOpen(false);
              setPreferredEntryId(null);
            }}
            onSaved={onEntrySaved}
          />
        </>
      )}
    </View>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  // FILTROS Y FILAS DE PRODUCTOS
  movementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 17,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  movementIcon: {
    width: 39,
    height: 39,
    backgroundColor: theme.surfaceHover,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOutline: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderColor: theme.border,
    borderWidth: 1,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  actionOutlineText: { fontSize: 12, color: theme.secondary },
  actionPrimary: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.mint,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  actionPrimaryText: { fontSize: 12, fontWeight: "700", color: theme.darkText },
  stockFilters: {
    flexDirection: "row",
    gap: 9,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterPillActive: { backgroundColor: theme.surfaceHover },
  filterPillText: { color: theme.muted, fontSize: 12 },
  filterPillTextActive: { color: theme.mint, fontWeight: "600" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 76,
  },
  productRowPressed: { backgroundColor: theme.surfaceHover },
  productRowMobile: { flexDirection: "column", alignItems: "stretch", gap: 13 },
  productMainMobile: { flex: 0, width: "100%" },
  desktopValues: { flex: 2, flexDirection: "row", alignItems: "center" },
  mobileStockLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 54,
  },
  productMain: {
    flex: 3,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minWidth: 0,
  },
  productSymbol: {
    width: 42,
    height: 42,
    backgroundColor: theme.surfaceHover,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  productTextWrap: { flex: 1, minWidth: 0 },
  productName: { fontSize: 13, color: theme.text, fontWeight: "600" },
  productMeta: {
    fontSize: 11,
    color: theme.secondary,
    lineHeight: 17,
    marginTop: 4,
  },
  priceColumn: { flex: 1, alignItems: "flex-end" },
  productPrice: { fontSize: 13, fontWeight: "600", color: theme.text },
  stockColumn: { flex: 1, alignItems: "flex-end" },
  stockNumber: { fontSize: 13, fontWeight: "700", color: theme.text },
  stockStatus: { fontSize: 11, color: theme.mint, marginTop: 4 },
  stockStatusOut: { color: "#FFBBBB" },
  stockAction: { fontSize: 10, color: theme.secondary, marginTop: 5 },
  app: {
    flex: 1,
    backgroundColor: theme.bg,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
  },

  // TOPBAR

  topbar: {
    minHeight: 76,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.panel,
    gap: 12,
  },

  topbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexShrink: 1,
  },

  topbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  brandSeparator: {
    width: 1,
    height: 25,
    backgroundColor: theme.border,
  },

  workspaceName: {
    color: theme.secondary,
    fontSize: 13,
    flexShrink: 1,
  },

  phaseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.surfaceHover,
    borderWidth: 1,
    borderColor: theme.border,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.mint,
  },

  phaseText: {
    color: theme.mint,
    fontSize: 12,
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },

  logoutText: {
    color: theme.secondary,
    fontSize: 13,
  },

  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },

  // LAYOUT

  body: {
    flex: 1,
    flexDirection: "row",
  },

  desktopSidebar: {
    width: 230,
    borderRightWidth: 1,
    borderRightColor: theme.border,
  },

  mainScroll: {
    flex: 1,
  },

  mainScrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },

  mainDesktop: {
    paddingHorizontal: 35,
    paddingVertical: 36,
  },

  mainMobile: {
    paddingHorizontal: 16,
    paddingVertical: 25,
  },

  mainInner: {
    width: "100%",
    maxWidth: 1150,
  },

  // SIDEBAR

  sidebar: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 34,
    paddingBottom: 25,
    backgroundColor: theme.panel,
    justifyContent: "space-between",
  },

  sidebarLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: theme.muted,
    marginHorizontal: 14,
    marginBottom: 27,
  },

  navItem: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 7,
  },

  navItemActive: {
    backgroundColor: theme.surfaceHover,
  },

  navText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.secondary,
    flexShrink: 1,
  },

  navTextActive: {
    color: theme.text,
    fontWeight: "600",
  },

  sidebarFooter: {
    paddingHorizontal: 12,
    gap: 12,
  },

  footerText: {
    color: theme.secondary,
    fontSize: 12,
    lineHeight: 19,
    maxWidth: 165,
  },

  footerDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 3,
  },

  footerCurrency: {
    fontSize: 12,
    color: theme.secondary,
  },

  // PAGE

  pageHeading: {
    marginBottom: 30,
    gap: 10,
  },

  pageTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
    color: theme.text,
  },

  pageSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.secondary,
  },

  smallHint: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 5,
  },

  errorBanner: {
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#794444",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  errorText: {
    color: "#FF9E9E",
    fontSize: 13,
    flex: 1,
  },

  retryButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  // WELCOME

  welcomeCard: {
    minHeight: 420,
    paddingHorizontal: 22,
    paddingVertical: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    justifyContent: "center",
    alignItems: "center",
  },

  welcomeIcon: {
    width: 78,
    height: 78,
    borderRadius: 20,
    backgroundColor: theme.surfaceHover,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
  },

  welcomeTitle: {
    fontSize: 23,
    fontWeight: "700",
    lineHeight: 30,
    textAlign: "center",
    color: theme.text,
    marginBottom: 12,
  },

  welcomeDescription: {
    color: theme.secondary,
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 430,
    marginBottom: 27,
  },

  primaryButton: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.mint,
    paddingHorizontal: 22,
    borderRadius: 11,
    gap: 9,
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.darkText,
  },

  welcomeNote: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 18,
    textAlign: "center",
  },

  // INVENTORY

  inventoryHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 29,
    gap: 14,
  },

  headingTextContainer: {
    flex: 1,
    gap: 5,
  },

  headingIcon: {
    width: 45,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 25,
  },

  statCard: {
    flexGrow: 1,
    flexBasis: 170,
    minWidth: 135,
    padding: 17,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 13,
    backgroundColor: theme.panel,
    gap: 8,
  },

  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },

  statLabel: {
    color: theme.secondary,
    fontSize: 12,
  },

  statValue: {
    color: theme.text,
    fontSize: 29,
    fontWeight: "700",
    lineHeight: 35,
  },

  statDescription: {
    fontSize: 11,
    color: theme.muted,
  },

  inventoryToolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginBottom: 25,
  },

  searchBox: {
    flexGrow: 1,
    flexBasis: 240,
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: theme.panel,
  },

  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 13,
    color: theme.text,
  },

  toolbarActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  disabledButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    opacity: 0.55,
  },

  disabledButtonText: {
    color: theme.secondary,
    fontSize: 12,
  },

  disabledPrimaryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
    backgroundColor: theme.mint,
    borderRadius: 10,
    opacity: 0.45,
  },

  disabledPrimaryText: {
    color: theme.darkText,
    fontSize: 12,
    fontWeight: "700",
  },

  productPanel: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    overflow: "hidden",
  },

  tableHeader: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  columnProduct: {
    flex: 3,
    color: theme.muted,
    fontSize: 10,
    letterSpacing: 1,
  },

  columnPrice: {
    flex: 1,
    color: theme.muted,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "right",
  },

  columnStock: {
    flex: 1,
    color: theme.muted,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "right",
  },

  emptyProducts: {
    minHeight: 295,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 16,
    backgroundColor: theme.surfaceHover,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.text,
    textAlign: "center",
    marginBottom: 9,
  },

  emptyDescription: {
    color: theme.secondary,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 340,
  },

  nextPhaseTag: {
    marginTop: 19,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: theme.surfaceHover,
  },

  nextPhaseText: {
    color: theme.mint,
    fontSize: 11,
  },

  inventoryFooter: {
    color: theme.muted,
    fontSize: 11,
    marginTop: 16,
  },

  // EMPTY MODULE

  moduleCard: {
    minHeight: 350,
    padding: 25,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    alignItems: "center",
    justifyContent: "center",
  },

  moduleIcon: {
    width: 75,
    height: 75,
    backgroundColor: theme.surfaceHover,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },

  moduleTitle: {
    fontSize: 21,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 12,
  },

  moduleDescription: {
    maxWidth: 380,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    color: theme.secondary,
    marginBottom: 25,
  },

  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  secondaryButtonText: {
    fontSize: 13,
    color: theme.text,
  },

  // MOBILE DRAWER

  drawerLayout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.60)",
  },

  drawerPanel: {
    width: 260,
    maxWidth: "85%",
    backgroundColor: theme.panel,
  },

  drawerHeader: {
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },

  drawerTitle: {
    color: theme.text,
    fontWeight: "600",
    fontSize: 16,
  },

  drawerBackdrop: {
    flex: 1,
  },

  // MODAL

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  modalCard: {
    width: "100%",
    maxWidth: 440,
    padding: 25,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    backgroundColor: theme.panel,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },

  modalTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },

  modalDescription: {
    color: theme.secondary,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 25,
  },

  inputLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 10,
  },

  nameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 15,
    color: theme.text,
    backgroundColor: theme.bg,
    fontSize: 14,
  },

  validationError: {
    color: "#FF9999",
    fontSize: 12,
    marginTop: 9,
  },

  modalNote: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 14,
  },

  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 27,
  },

  cancelButton: {
    minHeight: 45,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },

  cancelButtonText: {
    color: theme.secondary,
    fontSize: 13,
  },

  confirmButton: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.mint,
    borderRadius: 10,
  },

  confirmButtonText: {
    color: theme.darkText,
    fontWeight: "700",
    fontSize: 13,
  },
});
