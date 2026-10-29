import { AnalysisCards } from "@/components/sigelt/analysis-cards";
import { Copy, colors } from "@/components/sigelt/primitives";
import type { MonthlyReport } from "@/lib/reports";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

type Analysis = {
  analysis: string;
  model: string;
  generated_at: string;
  report: MonthlyReport;
};

export function InventoryAnalysis({
  month,
  inventoryId,
  onReport,
}: {
  month: string;
  inventoryId: string;
  onReport: (report: MonthlyReport) => void;
}) {
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function analyze() {
    if (pending.current) return;

    const controller = new AbortController();
    pending.current = controller;

    setBusy(true);
    setError("");
    setResult(null);

    try {
      const { data: auth, error: sessionError } =
        await supabase.auth.getSession();

      if (controller.signal.aborted) return;

      if (sessionError || !auth.session) {
        throw new Error("Vuelve a iniciar sesión para utilizar la IA.");
      }

      const { data, error: invokeError } =
        await supabase.functions.invoke<Analysis>("analyze-inventory", {
          body: { month },
          headers: {
            Authorization: "Bearer " + auth.session.access_token,
          },
          signal: controller.signal,
          timeout: 80000,
        });

      if (controller.signal.aborted) return;

      if (invokeError) {
        let message =
          "No pudimos conectar con la IA. Revisa tu conexión y reintenta.";

        if (invokeError instanceof FunctionsHttpError) {
          const response = invokeError.context as Response;
          const detail = await response.json().catch(() => null);

          message =
            "Error " +
            response.status +
            ": " +
            (detail?.error ||
              detail?.message ||
              "No se pudo generar el análisis.");
        }

        throw new Error(message);
      }

      if (
        !data ||
        typeof data.analysis !== "string" ||
        !data.analysis.trim() ||
        typeof data.model !== "string" ||
        !Number.isFinite(Date.parse(data.generated_at)) ||
        data.report?.schema_version !== 1 ||
        data.report.inventory?.id !== inventoryId ||
        data.report.period?.month?.slice(0, 7) !== month ||
        !data.report.summary ||
        !Array.isArray(data.report.products_sold) ||
        !Array.isArray(data.report.products_without_sales) ||
        !Array.isArray(data.report.current_stock?.alerts)
      ) {
        throw new Error("La respuesta no corresponde a este informe.");
      }

      if (controller.signal.aborted) return;

      // Muestra las mismas cifras que recibió Gemini.
      onReport(data.report);
      setResult(data);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err instanceof Error
            ? err.message
            : "No pudimos generar el análisis.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
      }

      if (pending.current === controller) {
        pending.current = null;
      }
    }
  }

  return (
    <View style={s.card}>
      <Copy accessibilityRole="header" style={s.title}>
        Tu inventario, con perspectiva
      </Copy>

      <Copy style={s.note}>
        Analiza las ventas del mes y las existencias actuales con ayuda de IA.
        Al pulsar el botón, estos datos se enviarán a Gemini.
      </Copy>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={analyze}
        style={({ pressed }) => [
          s.button,
          (pressed || busy) && { opacity: 0.6 },
        ]}
      >
        {busy && <ActivityIndicator color={colors.ink} />}

        <Copy style={s.buttonText}>
          {busy
            ? "Analizando…"
            : result
              ? "Generar de nuevo"
              : "Analizar con IA"}
        </Copy>
      </Pressable>

      {busy && (
        <Copy accessibilityLiveRegion="polite" style={s.note}>
          Consultando tu informe y preparando las recomendaciones…
        </Copy>
      )}

      {!!error && (
        <Copy accessibilityRole="alert" style={s.error}>
          {error}
        </Copy>
      )}

      {result && (
        <View style={s.answer}>
          <AnalysisCards text={result.analysis} />

          <Copy style={s.note}>
            Generado con {result.model} ·{" "}
            {new Date(result.generated_at).toLocaleString("es-CO", {
              timeZone: "America/Bogota",
            })}
          </Copy>

          <Copy style={s.note}>
            La IA puede equivocarse. Revisa las cifras antes de decidir. Este
            análisis no modifica productos ni existencias.
          </Copy>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    padding: 22,
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.mint,
  },
  note: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.muted,
  },
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.mint,
  },
  buttonText: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 14,
  },
  answer: {
    gap: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 18,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 25,
  },
  error: {
    color: "#ffb4ab",
    fontSize: 14,
    lineHeight: 22,
  },
});
