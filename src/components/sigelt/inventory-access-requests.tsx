import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { colors } from "@/components/sigelt/primitives";
import { supabase } from "@/lib/supabase";

type Decision = "approved" | "rejected";
type RequestState = "not_requested" | "pending" | Decision;

type PendingRequest = {
  request_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
};

type Inbox = {
  rows: PendingRequest[];
  message: string;
};

function errorMessage(error: unknown): string {
  const item = error as {
    code?: string;
    message?: string;
  } | null;

  if (item?.code === "42501" || item?.code === "22023") {
    return item.message || "No tienes permiso para esta operación.";
  }

  if (item?.code === "PGRST202" || item?.code === "42883") {
    return "Falta aplicar el bloque 13A o 13B en Supabase.";
  }

  return "No pudimos comprobar el resultado. Actualiza para consultarlo antes de volver a intentarlo.";
}

function readState(data: unknown): RequestState {
  const status = (data as { status?: unknown } | null)?.status;

  if (
    status === "not_requested" ||
    status === "pending" ||
    status === "approved" ||
    status === "rejected"
  ) {
    return status;
  }

  throw new Error("Respuesta de solicitud no válida.");
}

async function fetchMyRequest(signal: AbortSignal): Promise<RequestState> {
  const { data, error } = await supabase
    .rpc("get_my_inventory_access_request")
    .abortSignal(signal);

  if (error) throw error;

  return readState(data);
}

async function sendMyRequest(signal: AbortSignal): Promise<RequestState> {
  const { data, error } = await supabase
    .rpc("request_inventory_access")
    .abortSignal(signal);

  if (error) throw error;

  return readState(data);
}

async function fetchInbox(signal: AbortSignal): Promise<Inbox> {
  const rows: PendingRequest[] = [];
  const size = 100;

  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabase
      .rpc("list_inventory_access_requests")
      .range(offset, offset + size - 1)
      .abortSignal(signal);

    if (error) throw error;

    if (
      !Array.isArray(data) ||
      !data.every(
        (row) =>
          row &&
          typeof row.request_id === "string" &&
          typeof row.user_id === "string" &&
          typeof row.email === "string" &&
          typeof row.first_name === "string" &&
          typeof row.last_name === "string" &&
          typeof row.created_at === "string",
      )
    ) {
      throw new Error("Lista de solicitudes no válida.");
    }

    rows.push(...data);

    if (data.length < size) {
      return {
        rows: Array.from(
          new Map(rows.map((row) => [row.request_id, row])).values(),
        ),
        message: "",
      };
    }
  }
}

async function resolveRequest(
  id: string,
  decision: Decision,
  signal: AbortSignal,
): Promise<Inbox> {
  const { data, error } = await supabase
    .rpc("review_inventory_access_request", {
      p_request_id: id,
      p_decision: decision,
    })
    .abortSignal(signal);

  if (error) throw error;

  if (
    data?.request_id !== id ||
    data?.status !== decision ||
    typeof data?.changed !== "boolean"
  ) {
    throw new Error("Revisa la lista para comprobar el resultado.");
  }

  const next = await fetchInbox(signal);

  return {
    ...next,
    message: !data.changed
      ? "Esta solicitud ya había sido resuelta. Lista actualizada."
      : decision === "approved"
        ? "Solicitud aprobada. La cuenta ya puede acceder como vendedor."
        : "Solicitud rechazada. La cuenta conserva su registro.",
  };
}

// Evita solicitudes simultáneas y descarta respuestas al salir.
function useRequestData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  revision = 0,
) {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const mounted = useRef(false);
  const pending = useRef<AbortController | null>(null);

  const run = useCallback(
    async (
      operation: (signal: AbortSignal) => Promise<T> = load,
    ): Promise<T | null> => {
      if (!mounted.current || pending.current) return null;

      const controller = new AbortController();
      pending.current = controller;

      const timeout = setTimeout(() => controller.abort(), 20000);

      setBusy(true);
      setError("");

      try {
        const next = await operation(controller.signal);

        if (!mounted.current || pending.current !== controller) {
          return null;
        }

        setData(next);
        return next;
      } catch (err) {
        if (mounted.current && pending.current === controller) {
          setData(null);
          setError(errorMessage(err));
        }

        return null;
      } finally {
        clearTimeout(timeout);

        if (pending.current === controller) {
          pending.current = null;

          if (mounted.current) setBusy(false);
        }
      }
    },
    [load],
  );

  useEffect(() => {
    let alive = true;
    mounted.current = true;

    void Promise.resolve().then(() => {
      if (alive) void run();
    });

    return () => {
      alive = false;
      mounted.current = false;
      pending.current?.abort();
      pending.current = null;
    };
  }, [run, revision]);

  return { data, busy, error, run };
}

export function InventoryAccessRequest() {
  const { data: status, busy, error, run } = useRequestData(fetchMyRequest);

  return (
    <View style={s.box}>
      {busy && <ActivityIndicator color={colors.mint} />}

      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}

      {status === "not_requested" && (
        <>
          <Text style={s.text}>
            Envía una solicitud para que el administrador autorice tu acceso a
            Ventas.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void run(sendMyRequest)}
            style={[s.primary, busy && s.disabled]}
          >
            <Text style={s.primaryText}>
              {busy ? "Enviando…" : "Solicitar acceso"}
            </Text>
          </Pressable>
        </>
      )}

      {status === "pending" && (
        <Text style={s.text}>
          Solicitud enviada. Está pendiente de revisión por el administrador.
        </Text>
      )}

      {status === "rejected" && (
        <Text style={s.warning}>
          Tu solicitud fue rechazada. Contacta al administrador si necesitas que
          revise tu caso.
        </Text>
      )}

      {status === "approved" && (
        <Text style={s.text}>
          Tu solicitud fue aprobada. Pulsa Actualizar acceso para comprobar tu
          acceso actual.
        </Text>
      )}

      {!!error && (
        <Text style={s.text}>
          Pulsa Actualizar acceso para consultar de nuevo.
        </Text>
      )}
    </View>
  );
}

export function InventoryRequestsInbox({
  disabled = false,
  revision = 0,
  onReviewed,
}: {
  disabled?: boolean;
  revision?: number;
  onReviewed: (message: string) => void;
}) {
  const { data, busy, error, run } = useRequestData(fetchInbox, revision);

  const [confirm, setConfirm] = useState<{
    request: PendingRequest;
    decision: Decision;
  } | null>(null);

  const locked = disabled || busy;
  const rows = data?.rows ?? [];

  const selected =
    confirm && rows.some((row) => row.request_id === confirm.request.request_id)
      ? confirm
      : null;

  async function submitDecision() {
    if (!selected || locked) return;

    const result = await run((signal) =>
      resolveRequest(selected.request.request_id, selected.decision, signal),
    );

    if (result) {
      setConfirm(null);
      onReviewed(result.message);
    }
  }

  return (
    <View style={s.box}>
      <View style={s.row}>
        <Text style={s.title}>Solicitudes pendientes</Text>

        <Pressable
          accessibilityRole="button"
          disabled={locked}
          onPress={() => {
            setConfirm(null);
            void run();
          }}
          style={[s.secondary, locked && s.disabled]}
        >
          <Text style={s.secondaryText}>Actualizar solicitudes</Text>
        </Pressable>
      </View>

      <Text style={s.text}>
        Aprueba a las personas que trabajarán como vendedores en tu inventario.
      </Text>

      {busy && <ActivityIndicator color={colors.mint} />}

      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}

      {!busy && !error && rows.length === 0 && (
        <Text style={s.text}>No hay solicitudes pendientes.</Text>
      )}

      {!error &&
        rows.map((row) => (
          <View key={row.request_id} style={s.request}>
            <Text style={s.name}>
              {[row.first_name, row.last_name].join(" ").trim() || row.email}
            </Text>

            <Text selectable style={s.text}>
              {row.email}
            </Text>

            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                disabled={locked}
                onPress={() =>
                  setConfirm({
                    request: row,
                    decision: "approved",
                  })
                }
                style={[s.primary, locked && s.disabled]}
              >
                <Text style={s.primaryText}>Aprobar como vendedor</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={locked}
                onPress={() =>
                  setConfirm({
                    request: row,
                    decision: "rejected",
                  })
                }
                style={[s.secondary, locked && s.disabled]}
              >
                <Text style={s.warning}>Rechazar</Text>
              </Pressable>
            </View>

            {selected?.request.request_id === row.request_id && (
              <View style={s.confirmation}>
                <Text style={s.text}>
                  {selected.decision === "approved"
                    ? "Esta cuenta podrá registrar ventas en tu inventario."
                    : "Esta cuenta seguirá sin acceso al inventario."}
                </Text>

                <View style={s.row}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={locked}
                    onPress={() => void submitDecision()}
                    style={[s.primary, locked && s.disabled]}
                  >
                    <Text style={s.primaryText}>
                      {busy ? "Guardando…" : "Confirmar"}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={locked}
                    onPress={() => setConfirm(null)}
                    style={s.secondary}
                  >
                    <Text style={s.secondaryText}>Cancelar</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    flexGrow: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 22,
  },
  request: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    gap: 10,
  },
  confirmation: {
    backgroundColor: colors.bg,
    padding: 14,
    borderRadius: 10,
    gap: 12,
  },
  primary: {
    backgroundColor: colors.mint,
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  secondary: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.mint,
    fontSize: 13,
  },
  error: {
    color: "#FFAAAA",
    lineHeight: 22,
  },
  warning: {
    color: "#FFD37A",
    fontSize: 13,
    lineHeight: 22,
  },
  disabled: {
    opacity: 0.5,
  },
});
