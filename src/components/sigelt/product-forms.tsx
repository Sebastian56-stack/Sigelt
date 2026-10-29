import { Ionicons } from "@expo/vector-icons";
import {
    useEffect,
    useState,
    type ComponentProps,
    type ReactNode,
} from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
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

import { colors } from "@/components/sigelt/primitives";
import {
    createProduct,
    registerStockEntry,
    updateProduct,
    type Product,
} from "@/lib/products";

type IconName = ComponentProps<typeof Ionicons>["name"];

const palette = {
  bg: colors.bg,
  panel: colors.panel,
  border: colors.border,
  mint: colors.mint,
  muted: colors.muted,
  text: "#F5F7F5",
  secondary: "#A9B9AD",
  surface: "#141C17",
  hover: "#1C2A20",
  dark: "#09110B",
  danger: "#FFAAAA",
};

function getErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}

export function formatCOP(value: number): string {
  return (
    "$ " +
    new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  );
}

function parsePrice(raw: string): number | null {
  const text = raw.replace(/[$\s]/g, "");
  if (!text) return null;
  // Acepta 8500, 8.500, 8500,50 y 8.500,50.
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+([.,]\d{1,2})?$/.test(text)) {
    normalized = text.replace(",", ".");
  } else {
    return null;
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 && n <= 999999999999.99 ? n : null;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  keyboardType,
  multiline,
  maxLength = 120,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: palette.mint }}>*</Text>}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        keyboardType={keyboardType ?? "default"}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multiline]}
        autoCapitalize={keyboardType ? "none" : "sentences"}
      />
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function FormShell({
  visible,
  onClose,
  busy,
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  busy: boolean;
  title: string;
  subtitle: string;
  icon: IconName;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <ScrollView
          style={styles.overlayScroll}
          contentContainerStyle={styles.overlayContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Ionicons name={icon} size={23} color={palette.mint} />
              </View>
              <Pressable
                accessibilityLabel="Cerrar formulario"
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={onClose}
                style={styles.close}
              >
                <Ionicons
                  name="close-outline"
                  size={25}
                  color={palette.secondary}
                />
              </Pressable>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <View style={styles.fields}>{children}</View>
            <View style={styles.footer}>{footer}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalActions({
  busy,
  onCancel,
  onConfirm,
  confirmLabel,
  disabled = false,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={onCancel}
        disabled={busy}
        accessibilityRole="button"
        style={styles.cancelButton}
      >
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={busy || disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || disabled }}
        style={({ pressed }) => [
          styles.confirmButton,
          (pressed || busy || disabled) && { opacity: 0.65 },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={palette.dark} />
        ) : (
          <Ionicons name="checkmark-outline" size={19} color={palette.dark} />
        )}
        <Text style={styles.confirmText}>
          {busy ? "Guardando..." : confirmLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export function ProductCreateModal({
  visible,
  inventoryId,
  editingProduct = null,
  onClose,
  onSaved,
}: {
  visible: boolean;
  inventoryId: string;
  editingProduct?: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}) {
  const { width } = useWindowDimensions();
  const twoColumns = width >= 560;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("unidad");
  const [price, setPrice] = useState("");
  const [minimum, setMinimum] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;

    if (editingProduct) {
      setName(editingProduct.name);
      setCode(editingProduct.code);
      setCategory(editingProduct.category);
      setDescription(editingProduct.description ?? "");
      setUnit(editingProduct.unit);
      setPrice(String(editingProduct.sale_price));
      setMinimum(String(editingProduct.min_stock));
    } else {
      setName("");
      setCode("");
      setCategory("");
      setDescription("");
      setUnit("unidad");
      setPrice("");
      setMinimum("5");
    }

    setError("");
  }, [visible, editingProduct]);

  async function submit() {
    if (busy) return;
    const cleanName = name.trim();
    const cleanCode = code.trim();
    const cleanCategory = category.trim();
    const cleanUnit = unit.trim();
    const parsedPrice = parsePrice(price);
    const parsedMinimum = Number(minimum);

    if (!cleanName || !cleanCode || !cleanCategory || !cleanUnit) {
      setError("Completa nombre, código, categoría y unidad de venta.");
      return;
    }
    if (parsedPrice === null) {
      setError("Escribe un precio válido. Ejemplo: 8500 o 8.500.");
      return;
    }
    if (
      !/^\d+$/.test(minimum) ||
      !Number.isSafeInteger(parsedMinimum) ||
      parsedMinimum > 2147483647
    ) {
      setError(
        "La existencia mínima debe ser un número entero de 0 en adelante.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const productData = {
        name: cleanName,
        code: cleanCode,
        category: cleanCategory,
        description,
        unit: cleanUnit,
        sale_price: parsedPrice,
        min_stock: parsedMinimum,
      };

      const saved = editingProduct
        ? await updateProduct(editingProduct.id, productData)
        : await createProduct(inventoryId, productData);

      onSaved(saved);
    } catch (err) {
      console.error("No se pudo crear el producto:", err);
      setError(
        getErrorCode(err) === "23505"
          ? "Ya existe un producto con ese código en tu inventario."
          : "No se pudo guardar el producto. Revisa la conexión y los permisos.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell
      visible={visible}
      onClose={onClose}
      busy={busy}
      icon="cube-outline"
      title={editingProduct ? "Editar producto" : "Nuevo producto"}
      subtitle={
        editingProduct
          ? "Actualiza la información del producto sin modificar sus existencias."
          : "Añade un artículo a tu catálogo. Sus existencias comenzarán en cero hasta que registres una entrada."
      }
      footer={
        <ModalActions
          busy={busy}
          onCancel={onClose}
          onConfirm={() => void submit()}
          confirmLabel={editingProduct ? "Guardar cambios" : "Guardar producto"}
        />
      }
    >
      <Field
        label="Nombre del producto"
        required
        value={name}
        onChangeText={setName}
        placeholder="Ej. Cuaderno cuadriculado"
        maxLength={120}
      />
      <View style={[styles.pair, !twoColumns && styles.pairMobile]}>
        <View style={styles.pairCell}>
          <Field
            label="Código único"
            required
            value={code}
            onChangeText={setCode}
            placeholder="CUAD-001"
            maxLength={60}
          />
        </View>
        <View style={styles.pairCell}>
          <Field
            label="Categoría"
            required
            value={category}
            onChangeText={setCategory}
            placeholder="Papelería"
            maxLength={80}
          />
        </View>
      </View>
      <View style={[styles.pair, !twoColumns && styles.pairMobile]}>
        <View style={styles.pairCell}>
          <Field
            label="Unidad de venta"
            required
            value={unit}
            onChangeText={setUnit}
            placeholder="unidad, paquete, caja..."
            maxLength={45}
          />
        </View>
        <View style={styles.pairCell}>
          <Field
            label="Precio de venta (COP)"
            required
            value={price}
            onChangeText={setPrice}
            placeholder="8.500"
            keyboardType="decimal-pad"
            maxLength={18}
          />
        </View>
      </View>
      <Field
        label="Existencia mínima"
        required
        value={minimum}
        onChangeText={setMinimum}
        keyboardType="numeric"
        maxLength={10}
        hint="Nivel a partir del cual indicaremos que es necesario reponer."
      />
      <Field
        label="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        placeholder="100 hojas, tamaño carta..."
        multiline
        maxLength={500}
      />
      <View style={styles.infoBar}>
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={palette.mint}
        />
        <Text style={styles.infoText}>
          Crear el producto no agrega unidades. Para eso utiliza «Registrar
          entrada».
        </Text>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
    </FormShell>
  );
}

export function ProductEditModal({
  visible,
  product,
  onClose,
  onSaved,
}: {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}) {
  return (
    <ProductCreateModal
      visible={visible}
      inventoryId={product?.inventory_id ?? ""}
      editingProduct={product}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

export function StockEntryModal({
  visible,
  products,
  preferredProductId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  products: Product[];
  preferredProductId: string | null;
  onClose: () => void;
  onSaved: (productId: string, newStock: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setSelectedId(preferredProductId ?? products[0]?.id ?? null);
      setProductSearch("");
      setQuantity("");
      setNote("");
      setError("");
    }
  }, [visible, preferredProductId]);

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const filtered = products.filter((p) =>
    `${p.name} ${p.code}`
      .toLocaleLowerCase()
      .includes(productSearch.trim().toLocaleLowerCase()),
  );
  const validQty = /^\d+$/.test(quantity) ? Number(quantity) : 0;

  async function submit() {
    if (busy) return;
    if (!selected) {
      setError("Selecciona un producto de tu inventario.");
      return;
    }
    if (!Number.isSafeInteger(validQty) || validQty < 1 || validQty > 1000000) {
      setError("Ingresa una cantidad entera entre 1 y 1.000.000.");
      return;
    }
    if (note.trim().length > 250) {
      setError("La observación no puede superar los 250 caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const newStock = await registerStockEntry(selected.id, validQty, note);
      onSaved(selected.id, newStock);
    } catch (err) {
      console.error("No se pudo registrar la entrada:", err);
      setError(
        "No se pudo registrar la entrada. Verifica tu conexión o los permisos del producto.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell
      visible={visible}
      busy={busy}
      onClose={onClose}
      title="Registrar entrada"
      subtitle="Añade mercancía al inventario. Guardaremos la cantidad, fecha, usuario y observación en el historial."
      icon="enter-outline"
      footer={
        <ModalActions
          busy={busy}
          onCancel={onClose}
          onConfirm={() => void submit()}
          confirmLabel="Confirmar entrada"
          disabled={!selected}
        />
      }
    >
      <View style={styles.field}>
        <Text style={styles.label}>
          Producto <Text style={{ color: palette.mint }}>*</Text>
        </Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={19} color={palette.secondary} />
          <TextInput
            accessibilityLabel="Buscar producto para entrada"
            value={productSearch}
            onChangeText={setProductSearch}
            placeholder="Buscar por nombre o código..."
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
          />
        </View>
        <ScrollView
          nestedScrollEnabled={filtered.length > 1}
          scrollEnabled={filtered.length > 1}
          showsVerticalScrollIndicator={filtered.length > 1}
          style={[
            styles.productPicker,
            filtered.length <= 1 && {
              height: 76,
              maxHeight: 76,
              minHeight: 76,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.length === 0 ? (
            <Text style={styles.noResults}>
              No encontramos productos con esa búsqueda.
            </Text>
          ) : (
            filtered.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedId(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedId === item.id }}
                style={[
                  styles.pickerRow,
                  selectedId === item.id && styles.pickerRowActive,
                ]}
              >
                <View style={styles.pickerIcon}>
                  <Ionicons
                    name="cube-outline"
                    size={18}
                    color={palette.mint}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.pickerName}>
                    {item.name}
                  </Text>
                  <Text style={styles.pickerMeta}>
                    {item.code} · {item.stock_quantity} disponibles
                  </Text>
                </View>
                <Ionicons
                  name={
                    selectedId === item.id
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={
                    selectedId === item.id ? palette.mint : palette.secondary
                  }
                />
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
      <Field
        label="Cantidad que ingresa"
        required
        value={quantity}
        onChangeText={setQuantity}
        placeholder="Ej. 20"
        keyboardType="numeric"
        maxLength={7}
      />
      {selected && (
        <View style={styles.preview}>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewLabel}>Existencias actuales</Text>
            <Text style={styles.previewValue}>{selected.stock_quantity}</Text>
          </View>
          <Ionicons
            name="arrow-forward-outline"
            size={19}
            color={palette.mint}
          />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={styles.previewLabel}>Después de la entrada</Text>
            <Text style={[styles.previewValue, { color: palette.mint }]}>
              {selected.stock_quantity +
                (validQty > 0 && Number.isSafeInteger(validQty) ? validQty : 0)}
            </Text>
          </View>
        </View>
      )}
      <Field
        label="Observación (opcional)"
        value={note}
        onChangeText={setNote}
        placeholder="Ej. Compra al proveedor / referencia 123"
        multiline
        maxLength={250}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
    </FormShell>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)" },
  overlayScroll: { flex: 1 },
  overlayContent: {
    flexGrow: 1,
    padding: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 620,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 24,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: palette.hover,
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "700",
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: palette.secondary,
    marginTop: 10,
    marginBottom: 24,
  },
  fields: { gap: 18 },
  field: { gap: 8, flex: 1 },
  label: { fontSize: 12, color: palette.text, fontWeight: "600" },
  input: {
    minHeight: 47,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    color: palette.text,
    fontSize: 14,
  },
  multiline: { minHeight: 85, paddingVertical: 12 },
  fieldHint: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  pair: { flexDirection: "row", gap: 12 },
  pairMobile: { flexDirection: "column" },
  pairCell: { flex: 1 },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,

    paddingHorizontal: 16,
    paddingVertical: 15,

    marginTop: 12,
    marginBottom: 12,

    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.hover,
  },
  infoText: { color: palette.secondary, flex: 1, fontSize: 12, lineHeight: 20 },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 19 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    marginTop: 24,
    paddingTop: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 17,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: palette.border,
  },
  cancelText: { color: palette.secondary, fontSize: 13 },
  confirmButton: {
    minHeight: 46,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 18,
    backgroundColor: palette.mint,
    borderRadius: 10,
  },
  confirmText: { color: palette.dark, fontSize: 13, fontWeight: "700" },
  searchWrap: {
    minHeight: 47,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: { height: 44, flex: 1, color: palette.text, fontSize: 13 },
  productPicker: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 11,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  pickerRowActive: { backgroundColor: palette.hover },
  pickerIcon: {
    width: 36,
    height: 36,
    backgroundColor: palette.hover,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerName: { color: palette.text, fontSize: 13, fontWeight: "600" },
  pickerMeta: { color: palette.muted, fontSize: 11, marginTop: 4 },
  noResults: { padding: 18, color: palette.secondary, fontSize: 12 },
  preview: {
    backgroundColor: palette.hover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    padding: 17,
    gap: 16,
  },
  previewLabel: { color: palette.secondary, fontSize: 11 },
  previewValue: {
    color: palette.text,
    fontSize: 25,
    fontWeight: "700",
    marginTop: 5,
  },
});
