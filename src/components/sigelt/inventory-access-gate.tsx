import { InventoryAccessRequest } from "@/components/sigelt/inventory-access-requests";
import { Brand, colors } from "@/components/sigelt/primitives";
import {
  getMyInventoryAccess,
  inventoryAccessError,
  type ActiveInventoryAccess,
  type InventoryAccess,
} from "@/lib/inventory-users";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Redirect } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  children: (user: User, access: ActiveInventoryAccess) => ReactNode;
};

export function InventoryAccessGate({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    let authEventReceived = false;
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!alive) return;
        authEventReceived = true;
        setUser(session?.user ?? null);
        setError("");
        setLoading(false);
      },
    );
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!alive || authEventReceived) return;
        if (sessionError) throw sessionError;
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive || authEventReceived) return;
        setError("No pudimos comprobar tu sesión.");
        setLoading(false);
      });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [retry]);

  if (loading) return <Loading />;
  if (error)
    return (
      <AccessMessage
        title="Revisemos tu conexión"
        description={error}
        onRetry={() => {
          setLoading(true);
          setError("");
          setRetry((n) => n + 1);
        }}
      />
    );
  if (!user) return <Redirect href="/auth" />;
  // Al cambiar de cuenta se descarta todo el estado de la cuenta anterior.
  return (
    <AccessForUser key={user.id} user={user}>
      {children}
    </AccessForUser>
  );
}

function AccessForUser({ user, children }: Props & { user: User }) {
  const [access, setAccess] = useState<InventoryAccess | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    let pending: AbortController | null = null;
    async function refresh() {
      if (pending) return;
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(), 15000);
      setChecking(true);
      try {
        const next = await getMyInventoryAccess(controller.signal);
        if (alive) {
          setAccess(next);
          setError("");
        }
      } catch (err) {
        if (alive) {
          setAccess(null);
          setError(inventoryAccessError(err));
        }
      } finally {
        clearTimeout(timeout);
        pending = null;
        if (alive) setChecking(false);
      }
    }
    function onForeground() {
      if (
        Platform.OS === "web" &&
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      if (Platform.OS !== "web" && AppState.currentState !== "active") return;
      void refresh();
    }
    void refresh();
    const timer = setInterval(onForeground, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    if (Platform.OS === "web" && typeof window !== "undefined")
      window.addEventListener("focus", onForeground);
    return () => {
      alive = false;
      pending?.abort();
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === "web" && typeof window !== "undefined")
        window.removeEventListener("focus", onForeground);
    };
  }, [retry]);

  if (!access && checking && !error) return <Loading />;
  if (error)
    return (
      <AccessMessage
        title="No pudimos verificar tu acceso"
        description={error}
        email={user.email}
        checking={checking}
        onRetry={() => setRetry((n) => n + 1)}
      />
    );
  if (access?.state === "active") return <>{children(user, access)}</>;
  const suspended = access?.state === "suspended";
  return (
    <AccessMessage
      title={suspended ? "Tu acceso está suspendido" : "Tu cuenta está lista"}
      description={
        suspended
          ? "Contacta al administrador de tu inventario para solicitar la reactivación de tu acceso."
          : "Solicita acceso para trabajar como vendedor en este inventario."
      }
      email={user.email}
      checking={checking}
      onRetry={() => setRetry((n) => n + 1)}
    >
      {access?.state === "pending" && <InventoryAccessRequest key={retry} />}
    </AccessMessage>
  );
}

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.mint} size="large" />
      <Text style={styles.description}>Comprobando tu acceso…</Text>
    </View>
  );
}

function AccessMessage({
  title,
  description,
  email,
  onRetry,
  checking = false,
  children,
}: {
  title: string;
  description: string;
  email?: string;
  onRetry: () => void;
  checking?: boolean;
  children?: ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (leaving) return;
    setLeaving(true);
    setError("");
    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signOutError) throw signOutError;
    } catch {
      setError("No pudimos cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setLeaving(false);
    }
  }
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.center}>
      <View style={styles.card}>
        <Brand />
        <Text style={styles.eyebrow}>SIGELT · ACCESO</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {!!email && (
          <Text selectable style={styles.email}>
            {email}
          </Text>
        )}
        {children}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={checking || leaving}
          onPress={onRetry}
          style={[styles.button, (checking || leaving) && styles.disabled]}
        >
          <Text style={styles.buttonText}>
            {checking ? "Comprobando…" : "Actualizar acceso"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={leaving}
          onPress={() => void logout()}
          style={styles.logout}
        >
          <Text style={styles.description}>
            {leaving ? "Cerrando…" : "Cerrar sesión"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  center: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 20,
    backgroundColor: colors.bg,
  },
  card: {
    width: "100%",
    maxWidth: 540,
    padding: 28,
    gap: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.panel,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.mint,
    marginTop: 18,
  },
  title: { color: colors.text, fontSize: 27, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  email: { color: colors.text, fontSize: 15, fontWeight: "600" },
  button: {
    minHeight: 48,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  buttonText: { color: colors.ink, fontWeight: "700" },
  logout: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  error: { color: "#FFAAAA", lineHeight: 22 },
  disabled: { opacity: 0.55 },
});
