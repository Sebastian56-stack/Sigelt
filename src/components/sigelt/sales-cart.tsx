import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";

import { colors } from "@/components/sigelt/primitives";
import type { Product } from "@/lib/products";
import { confirmSale } from "@/lib/sales";

const theme = {
  panel: colors.panel,
  border: colors.border,
  mint: colors.mint,
  muted: colors.muted,
  text: "#F5F7F5",
  secondary: "#A9B9AD",
  surface: "#141C17",
  dark: "#09110B",
  danger: "#FFAAAA",
};

type Props = {
  inventoryId: string;
  products: Product[];
  loading: boolean;
  onSaleConfirmed: () => void;
};

type Cart = Record<string, number>;
type Drafts = Record<string, string>;

function money(value: number) {
  return (
    "$ " +
    new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  );
}

// Identificador para reconocer reintentos de la misma venta.
function newRequestId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Alternativa compatible cuando randomUUID no está disponible.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 3) | 8;
    return value.toString(16);
  });
}

export function SalesCart({
  inventoryId,
  products,
  loading,
  onSaleConfirmed,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 1200;

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [drafts, setDrafts] = useState<Drafts>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedSaleId, setSavedSaleId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);
  const sendingRef = useRef(false);

  const matchingProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();

    return products.filter(
      (product) =>
        product.status === "active" &&
        `${product.name} ${product.code} ${product.category}`
          .toLocaleLowerCase()
          .includes(term),
    );
  }, [products, search]);

  // Mostramos 50 resultados para no saturar la interfaz.
  const visibleProducts = matchingProducts.slice(0, 50);

  const cartRows = products
    .filter((product) => (cart[product.id] ?? 0) > 0)
    .map((product) => ({
      ...product,
      quantity: cart[product.id],
    }));

  const itemCount = cartRows.reduce(
    (total, product) => total + product.quantity,
    0,
  );

  const total = cartRows.reduce(
    (sum, product) => sum + product.quantity * Number(product.sale_price),
    0,
  );

  function changeQuantity(product: Product, quantity: number) {
    if (saving) return;

    const available = Math.max(0, product.stock_quantity);
    const nextQuantity = Math.min(available, Math.max(0, Math.floor(quantity)));

    setCart((current) => {
      const next = { ...current };

      if (nextQuantity === 0) {
        delete next[product.id];
      } else {
        next[product.id] = nextQuantity;
      }

      return next;
    });

    setDrafts((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });

    setRequestId(newRequestId());
    setError("");
    setSavedSaleId(null);
  }

  function finishQuantityEdit(product: Product) {
    const text = drafts[product.id];

    if (text === undefined) return;

    const quantity = Number(text);

    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setError("La cantidad debe ser un número entero mayor que cero.");

      setDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });

      return;
    }

    if (quantity > product.stock_quantity) {
      setError(
        `Solo tienes ${product.stock_quantity} unidades disponibles de ${product.name}.`,
      );
    }

    changeQuantity(product, Math.min(quantity, product.stock_quantity));
  }

  function emptyCart() {
    if (saving) return;

    setCart({});
    setDrafts({});
    setRequestId(newRequestId());
    setError("");
    setSavedSaleId(null);
  }

  function reviewSale() {
    if (cartRows.length === 0) return;

    if (Object.keys(drafts).length > 0) {
      setError("Termina de editar las cantidades antes de continuar.");
      return;
    }

    const invalid = cartRows.find(
      (product) =>
        product.quantity < 1 || product.quantity > product.stock_quantity,
    );

    if (invalid) {
      setError(`Revisa las existencias disponibles de ${invalid.name}.`);
      return;
    }

    setError("");
    setReviewOpen(true);
  }

  async function registerSale() {
    if (sendingRef.current || cartRows.length === 0) return;

    sendingRef.current = true;
    setSaving(true);
    setError("");

    try {
      const saleId = await confirmSale(
        inventoryId,
        requestId,
        cartRows.map((product) => ({
          productId: product.id,
          quantity: product.quantity,
        })),
      );

      setSavedSaleId(saleId);
      setCart({});
      setDrafts({});
      setRequestId(newRequestId());
      setReviewOpen(false);

      // Volver a consultar existencias y movimientos.
      onSaleConfirmed();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar la venta.",
      );
      setReviewOpen(false);

      // Conservamos el carrito y el identificador de solicitud.
      // Así un reintento no descuenta dos veces la misma venta.
    } finally {
      sendingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons name="cart-outline" size={25} color={theme.mint} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nueva venta</Text>
          <Text style={styles.subtitle}>
            Selecciona productos, ajusta las cantidades y revisa la venta antes
            de confirmarla.
          </Text>
        </View>
      </View>

      {!!savedSaleId && (
        <View style={styles.successBox}>
          <Ionicons
            name="checkmark-circle-outline"
            size={23}
            color={theme.mint}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>
              Venta registrada correctamente
            </Text>
            <Text style={styles.subtitle}>
              Referencia: {savedSaleId.slice(0, 8).toUpperCase()}
              {"\n"}Se actualizaron las existencias.
            </Text>
          </View>
        </View>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={theme.danger}
          />
          <Text style={[styles.subtitle, { color: theme.danger, flex: 1 }]}>
            {error}
          </Text>
        </View>
      )}

      <View style={[styles.columns, wide && styles.columnsWide]}>
        {/* ======================================== */}
        {/* CATÁLOGO DE PRODUCTOS */}
        {/* ======================================== */}

        <View style={[styles.panel, wide && { flex: 1.15 }]}>
          <View style={styles.panelHeading}>
            <Ionicons name="cube-outline" size={20} color={theme.mint} />
            <Text style={styles.panelTitle}>Productos disponibles</Text>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color={theme.secondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por nombre, código o categoría..."
              placeholderTextColor={theme.muted}
              style={styles.searchInput}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.helper}>
            {matchingProducts.length} productos encontrados
            {matchingProducts.length > 50 ? " · mostrando los primeros 50" : ""}
          </Text>

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={theme.mint} />
              <Text style={styles.subtitle}>Cargando productos...</Text>
            </View>
          ) : visibleProducts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="search-outline"
                size={29}
                color={theme.secondary}
              />
              <Text style={styles.subtitle}>No encontramos productos.</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 440 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {visibleProducts.map((product) => {
                const available = Math.max(0, product.stock_quantity);
                const selected = cart[product.id] ?? 0;
                const disabled = available === 0 || selected >= available;

                return (
                  <View key={product.id} style={styles.catalogRow}>
                    <View style={styles.productIcon}>
                      <Ionicons
                        name="cube-outline"
                        size={20}
                        color={theme.secondary}
                      />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.subtitle}>
                        {product.code} · {product.category}
                      </Text>
                      <Text style={styles.price}>
                        {money(Number(product.sale_price))}
                      </Text>
                      <Text style={styles.helper}>
                        {available} {product.unit} disponibles
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Agregar ${product.name}`}
                      disabled={disabled || saving}
                      onPress={() => changeQuantity(product, selected + 1)}
                      style={[
                        styles.addButton,
                        (disabled || saving) && styles.disabled,
                      ]}
                    >
                      <Ionicons
                        name="add-outline"
                        size={18}
                        color={theme.dark}
                      />
                      <Text style={styles.addText}>Agregar</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ======================================== */}
        {/* CARRITO */}
        {/* ======================================== */}

        <View style={[styles.panel, wide && { flex: 0.85 }]}>
          <View style={styles.panelHeading}>
            <Ionicons name="basket-outline" size={21} color={theme.mint} />
            <Text style={styles.panelTitle}>Carrito de venta</Text>
          </View>

          <Text style={styles.helper}>
            {cartRows.length} tipos de producto · {itemCount} unidades
          </Text>

          {cartRows.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={35} color={theme.secondary} />
              <Text style={styles.emptyTitle}>Tu carrito está vacío.</Text>
              <Text style={styles.subtitle}>
                Agrega productos desde el catálogo.
              </Text>
            </View>
          ) : (
            <>
              {cartRows.map((product) => (
                <View key={product.id} style={styles.cartRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.subtitle}>
                      {money(Number(product.sale_price))} / {product.unit}
                    </Text>
                    <Text style={styles.price}>
                      {money(product.quantity * Number(product.sale_price))}
                    </Text>
                  </View>

                  <View style={styles.quantityControls}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar una unidad de ${product.name}`}
                      disabled={saving}
                      onPress={() =>
                        changeQuantity(product, product.quantity - 1)
                      }
                      style={styles.quantityButton}
                    >
                      <Ionicons
                        name="remove-outline"
                        size={18}
                        color={theme.text}
                      />
                    </Pressable>

                    <TextInput
                      style={styles.quantityInput}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      maxLength={7}
                      editable={!saving}
                      value={drafts[product.id] ?? String(product.quantity)}
                      onChangeText={(text) =>
                        setDrafts((current) => ({
                          ...current,
                          [product.id]: text.replace(/\D/g, ""),
                        }))
                      }
                      onBlur={() => finishQuantityEdit(product)}
                      onSubmitEditing={() => finishQuantityEdit(product)}
                    />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Agregar una unidad de ${product.name}`}
                      disabled={
                        saving || product.quantity >= product.stock_quantity
                      }
                      onPress={() =>
                        changeQuantity(product, product.quantity + 1)
                      }
                      style={[
                        styles.quantityButton,
                        product.quantity >= product.stock_quantity &&
                          styles.disabled,
                      ]}
                    >
                      <Ionicons
                        name="add-outline"
                        size={18}
                        color={theme.text}
                      />
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Eliminar ${product.name} del carrito`}
                      disabled={saving}
                      onPress={() => changeQuantity(product, 0)}
                      style={styles.quantityButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.danger}
                      />
                    </Pressable>
                  </View>
                </View>
              ))}

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={emptyCart}
                style={styles.clearButton}
              >
                <Text style={styles.clearText}>Vaciar carrito</Text>
              </Pressable>
            </>
          )}

          <View style={styles.totalBox}>
            <Text style={styles.subtitle}>Total de la venta</Text>
            <Text style={styles.total}>{money(total)}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={cartRows.length === 0 || saving}
            onPress={reviewSale}
            style={[
              styles.primaryButton,
              (cartRows.length === 0 || saving) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>Revisar venta</Text>
            <Ionicons
              name="arrow-forward-outline"
              size={18}
              color={theme.dark}
            />
          </Pressable>
        </View>
      </View>

      {/* ======================================== */}
      {/* CONFIRMACIÓN */}
      {/* ======================================== */}

      <Modal
        transparent
        visible={reviewOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setReviewOpen(false);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Ionicons name="receipt-outline" size={30} color={theme.mint} />

            <Text style={styles.modalTitle}>¿Confirmar esta venta?</Text>

            <Text style={styles.subtitle}>
              Revisa los productos antes de registrar la operación. Al confirmar
              se descontarán las existencias.
            </Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {cartRows.map((product) => (
                <View key={product.id} style={styles.summaryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.subtitle}>
                      {product.quantity} × {money(Number(product.sale_price))}
                    </Text>
                  </View>
                  <Text style={styles.price}>
                    {money(product.quantity * Number(product.sale_price))}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.totalBox}>
              <Text style={styles.subtitle}>Total</Text>
              <Text style={styles.total}>{money(total)}</Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setReviewOpen(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>No, volver</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void registerSale()}
                style={[
                  styles.primaryButton,
                  { flex: 1 },
                  saving && styles.disabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={theme.dark} />
                ) : (
                  <Text style={styles.primaryText}>Sí, confirmar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 18,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
  },
  headingIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.text,
    fontSize: 25,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.secondary,
    fontSize: 12,
    lineHeight: 19,
  },
  columns: {
    gap: 17,
  },
  columnsWide: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  panel: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 15,
    padding: 18,
    gap: 14,
  },
  panelHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  panelTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 47,
    paddingHorizontal: 13,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: theme.text,
    fontSize: 13,
  },
  helper: {
    color: theme.muted,
    fontSize: 11,
  },
  catalogRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  productIcon: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  productName: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  price: {
    color: theme.mint,
    fontWeight: "700",
    fontSize: 13,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.mint,
    borderRadius: 9,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  addText: {
    color: theme.dark,
    fontWeight: "700",
    fontSize: 12,
  },
  disabled: {
    opacity: 0.4,
  },
  empty: {
    minHeight: 165,
    justifyContent: "center",
    alignItems: "center",
    gap: 11,
    padding: 18,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  cartRow: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingVertical: 15,
    gap: 12,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityButton: {
    width: 37,
    height: 37,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInput: {
    width: 61,
    height: 37,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    textAlign: "center",
    fontSize: 14,
    paddingHorizontal: 3,
  },
  clearButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
  },
  clearText: {
    color: theme.danger,
    fontSize: 12,
  },
  totalBox: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 17,
    gap: 7,
  },
  total: {
    color: theme.text,
    fontSize: 27,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: theme.mint,
    minHeight: 47,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
  },
  primaryText: {
    color: theme.dark,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 47,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: "#693C3C",
    borderRadius: 11,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  successBox: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.mint,
    borderRadius: 11,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successTitle: {
    color: theme.mint,
    fontWeight: "700",
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.74)",
    justifyContent: "center",
    alignItems: "center",
    padding: 17,
  },
  modalCard: {
    width: "100%",
    maxWidth: 525,
    padding: 23,
    borderRadius: 16,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 17,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 21,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
});
