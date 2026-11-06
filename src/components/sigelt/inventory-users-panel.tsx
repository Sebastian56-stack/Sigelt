import { InventoryRequestsInbox } from "@/components/sigelt/inventory-access-requests";
import { colors } from "@/components/sigelt/primitives";
import {
  addInventoryUser,
  inventoryAccessError,
  listInventoryUsers,
  setInventoryUserStatus,
  type InventoryMember,
} from "@/lib/inventory-users";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export function InventoryUsersPanel({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [members, setMembers] = useState<InventoryMember[]>([]);
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const alive = useRef(true);
  const sending = useRef(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const version = ++request.current;
    try {
      const rows = await listInventoryUsers();
      if (alive.current && version === request.current) {
        setMembers(rows);
        setError("");
      }
    } catch (err) {
      if (alive.current && version === request.current) {
        setMembers([]);
        setError(inventoryAccessError(err));
      }
    } finally {
      if (alive.current && version === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const generation = request;
    const version = ++generation.current;
    void listInventoryUsers()
      .then((rows) => {
        if (alive.current && version === generation.current) {
          setMembers(rows);
          setError("");
        }
      })
      .catch((err) => {
        if (alive.current && version === generation.current) {
          setMembers([]);
          setError(inventoryAccessError(err));
        }
      })
      .finally(() => {
        if (alive.current && version === generation.current) setLoading(false);
      });
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);

  async function add() {
    if (sending.current || loading) return;
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("Escribe el correo completo del vendedor.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setConfirmId(null);
    try {
      const result = await addInventoryUser(clean);
      if (!alive.current) return;
      setEmail("");
      setMessage(
        result.already_member
          ? "Este vendedor ya tenía acceso al inventario."
          : "Vendedor agregado. Ya puede entrar a Sigelt con su cuenta.",
      );
      setLoading(true);
      await load();
    } catch (err) {
      if (alive.current) setError(inventoryAccessError(err));
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function changeStatus(member: InventoryMember) {
    if (
      sending.current ||
      loading ||
      member.role !== "user" ||
      member.user_id === currentUserId
    )
      return;
    const status = member.access_status === "active" ? "suspended" : "active";
    sending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await setInventoryUserStatus(member.user_id, status);
      if (!alive.current) return;
      setConfirmId(null);
      setMessage(
        status === "suspended"
          ? "Acceso suspendido. Sus ventas permanecen guardadas."
          : "Acceso reactivado. El vendedor puede volver a registrar ventas.",
      );
      setLoading(true);
      await load();
    } catch (err) {
      if (alive.current) setError(inventoryAccessError(err));
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const term = search.trim().toLocaleLowerCase();
  const visible = members.filter((m) =>
    `${m.first_name} ${m.last_name} ${m.email}`
      .toLocaleLowerCase()
      .includes(term),
  );
  const active = members.filter(
    (m) => m.role === "user" && m.access_status === "active",
  ).length;
  const suspended = members.filter(
    (m) => m.role === "user" && m.access_status === "suspended",
  ).length;
  const disabled = busy || loading;

  return (
    <View style={s.page}>
      <View style={s.heading}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>TU EQUIPO</Text>
          <Text style={s.title}>Usuarios</Text>
          <Text style={s.description}>
            Personas que trabajan en tu inventario. Tú decides quién puede
            vender.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => {
            setConfirmId(null);
            setLoading(true);
            setError("");
            void load();
          }}
          style={[s.secondaryButton, disabled && s.disabled]}
        >
          <Ionicons name="refresh-outline" color={colors.mint} size={17} />
          <Text style={s.secondaryText}>Actualizar</Text>
        </Pressable>
      </View>

      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {message}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}

      <InventoryRequestsInbox
        disabled={disabled}
        revision={members.length}
        onReviewed={(message) => {
          setMessage(message);
          setError("");
          setConfirmId(null);
          setLoading(true);
          void load();
        }}
      />

      <View style={s.card}>
        <View style={s.heading}>
          <Ionicons name="person-add-outline" color={colors.mint} size={24} />
          <Text style={s.cardTitle}>Agregar vendedor</Text>
        </View>
        <Text style={s.description}>
          Debe registrarse en Sigelt y confirmar su correo. Después, agrégalo
          aquí para que trabaje en este inventario.
        </Text>
        <Text style={s.label}>Correo electrónico</Text>
        <View style={s.formRow}>
          <TextInput
            accessibilityLabel="Correo del vendedor"
            value={email}
            onChangeText={setEmail}
            placeholder="vendedor@correo.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={254}
            editable={!disabled}
            returnKeyType="done"
            onSubmitEditing={() => void add()}
            style={[s.input, s.emailInput]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => void add()}
            style={[s.primaryButton, disabled && s.disabled]}
          >
            <Text style={s.primaryText}>
              {busy ? "Guardando…" : "Dar acceso a ventas"}
            </Text>
          </Pressable>
        </View>
        <Text style={s.hint}>
          El perfil Vendedor permite registrar ventas. La gestión de productos,
          entradas, informes y usuarios queda a cargo del administrador.
        </Text>
      </View>

      <View style={s.summary}>
        <Text style={s.summaryText}>
          {loading ? "…" : members.length} usuarios
        </Text>
        <Text style={s.summaryText}>
          {loading ? "…" : active} vendedores activos
        </Text>
        <Text style={s.summaryText}>
          {loading ? "…" : suspended} suspendidos
        </Text>
      </View>

      <TextInput
        accessibilityLabel="Buscar usuarios"
        placeholder="Buscar por nombre o correo…"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setConfirmId(null);
        }}
        style={s.input}
      />

      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator color={colors.mint} />
          <Text style={s.description}>Cargando usuarios…</Text>
        </View>
      ) : visible.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.description}>
            {error
              ? "Actualiza la lista para volver a intentarlo."
              : "No hay usuarios que coincidan con la búsqueda."}
          </Text>
        </View>
      ) : (
        visible.map((member) => {
          const isAdmin = member.role === "admin";
          const isSuspended = member.access_status === "suspended";
          const canChange = !isAdmin && member.user_id !== currentUserId;
          const name =
            `${member.first_name} ${member.last_name}`.trim() || member.email;
          return (
            <View key={member.user_id} style={s.card}>
              <View style={s.memberRow}>
                <View style={s.avatar}>
                  <Ionicons
                    name={
                      isAdmin ? "shield-checkmark-outline" : "person-outline"
                    }
                    size={23}
                    color={colors.mint}
                  />
                </View>
                <View style={s.identity}>
                  <Text style={s.name}>
                    {name}
                    {member.user_id === currentUserId ? " · Tú" : ""}
                  </Text>
                  <Text selectable style={s.description}>
                    {member.email}
                  </Text>
                  <View style={s.tags}>
                    <Text style={s.role}>
                      {isAdmin ? "Administrador" : "Vendedor"}
                    </Text>
                    <Text style={[s.status, isSuspended && s.suspended]}>
                      {isSuspended ? "Suspendido" : "Activo"}
                    </Text>
                  </View>
                </View>
                {canChange ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={disabled}
                    accessibilityLabel={`${isSuspended ? "Reactivar" : "Suspender"} acceso de ${name}`}
                    onPress={() => {
                      setConfirmId(member.user_id);
                      setMessage("");
                    }}
                    style={[s.secondaryButton, disabled && s.disabled]}
                  >
                    <Text style={isSuspended ? s.secondaryText : s.dangerText}>
                      {isSuspended ? "Reactivar" : "Suspender"}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={s.hint}>Acceso de administración</Text>
                )}
              </View>
              {canChange && confirmId === member.user_id && (
                <View style={s.confirmation}>
                  <Text style={s.description}>
                    {isSuspended
                      ? "Podrá volver a registrar ventas en este inventario."
                      : "Dejará de poder registrar ventas y consultar el inventario. Sus ventas anteriores se conservarán."}
                  </Text>
                  <View style={s.tags}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={disabled}
                      onPress={() => void changeStatus(member)}
                      style={[s.primaryButton, disabled && s.disabled]}
                    >
                      <Text style={s.primaryText}>
                        {busy
                          ? "Guardando…"
                          : isSuspended
                            ? "Confirmar reactivación"
                            : "Confirmar suspensión"}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={disabled}
                      onPress={() => setConfirmId(null)}
                      style={s.secondaryButton}
                    >
                      <Text style={s.secondaryText}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { gap: 18, paddingBottom: 24 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  grow: { flexGrow: 1, flexBasis: 240, gap: 9 },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.mint },
  title: { fontSize: 30, fontWeight: "700", color: colors.text },
  description: { fontSize: 13, lineHeight: 22, color: colors.muted },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 17,
    padding: 22,
    gap: 14,
  },
  cardTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
  label: { fontSize: 12, color: colors.text, marginTop: 6 },
  formRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  input: {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
  },
  emailInput: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 11,
    backgroundColor: colors.mint,
  },
  primaryText: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryText: { color: colors.mint, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 19 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  summaryText: { color: colors.muted, fontSize: 12 },
  notice: {
    backgroundColor: "#1C3020",
    color: colors.mint,
    padding: 16,
    borderRadius: 12,
    lineHeight: 22,
  },
  error: {
    backgroundColor: "#301C20",
    color: "#FFAAAA",
    padding: 16,
    borderRadius: 12,
    lineHeight: 22,
  },
  empty: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  memberRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 15,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#1C2A20",
    justifyContent: "center",
    alignItems: "center",
  },
  identity: { flexGrow: 1, flexBasis: 220, minWidth: 0, gap: 5 },
  name: { fontSize: 15, color: colors.text, fontWeight: "600" },
  tags: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  role: { fontSize: 11, color: colors.text },
  status: {
    color: colors.mint,
    fontSize: 11,
    backgroundColor: "#1C2A20",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  suspended: { color: "#FFD37A", backgroundColor: "#302818" },
  dangerText: { color: "#FFD37A", fontSize: 13 },
  confirmation: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    gap: 12,
  },
  disabled: { opacity: 0.55 },
});
