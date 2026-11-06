import type { ForecastAdvisorContext } from "@/lib/forecast-advisor-context";
import { supabase } from "@/lib/supabase";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AnalysisCards } from "./analysis-cards";
import { colors, Copy } from "./primitives";

type Answer = {
  analysis: string;
  model: string;
  generated_at: string;
  source: "synthetic";
};

function isAnswer(value: unknown): value is Answer {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    item.source === "synthetic" &&
    typeof item.analysis === "string" &&
    item.analysis.trim().length > 0 &&
    item.analysis.length <= 12000 &&
    typeof item.model === "string" &&
    typeof item.generated_at === "string" &&
    Number.isFinite(Date.parse(item.generated_at))
  );
}

export function ForecastAdvisor({
  context,
}: {
  context: ForecastAdvisorContext;
}) {
  return <AdvisorRequest key={JSON.stringify(context)} context={context} />;
}

function AdvisorRequest({ context }: { context: ForecastAdvisorContext }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
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
    setAnswer(null);

    try {
      const { data: auth, error: sessionError } =
        await supabase.auth.getSession();

      if (controller.signal.aborted) return;

      if (sessionError || !auth.session) {
        throw new Error("Vuelve a iniciar sesión para utilizar el asesor.");
      }

      const { data, error: requestError } =
        await supabase.functions.invoke<unknown>("analyze-forecast", {
          body: { context },
          headers: {
            Authorization: "Bearer " + auth.session.access_token,
          },
          signal: controller.signal,
          timeout: 80000,
        });

      if (controller.signal.aborted) return;

      if (requestError) {
        let message = "No pudimos conectar con el asesor. Revisa tu conexión.";

        if (requestError instanceof FunctionsHttpError) {
          const response = requestError.context as Response;
          const detail = await response.json().catch(() => null);
          const explanation = detail?.error ?? detail?.message;

          message = `Error ${response.status}: ${
            typeof explanation === "string"
              ? explanation
              : "No se pudo completar el análisis."
          }`;
        }

        throw new Error(message);
      }

      if (!isAnswer(data)) {
        throw new Error("El asesor devolvió una respuesta incompleta.");
      }

      if (!controller.signal.aborted) {
        setAnswer(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "No se pudo analizar.");
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
    <View style={s.panel}>
      <Copy accessibilityRole="header" style={s.title}>
        Asesor del escenario
      </Copy>

      <Copy style={s.note}>
        Compara el plazo elegido con una entrega inmediata y explica los
        posibles faltantes. Al pulsar el botón se enviarán a Gemini este
        pronóstico sintético y los valores del simulador.
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
            ? "Analizando escenario…"
            : answer
              ? "Analizar de nuevo"
              : "Analizar este escenario"}
        </Copy>
      </Pressable>

      {busy && (
        <Copy accessibilityLiveRegion="polite" style={s.note}>
          Preparando la explicación y las alternativas…
        </Copy>
      )}

      {!!error && (
        <Copy accessibilityRole="alert" style={s.error}>
          {error}
        </Copy>
      )}

      {answer && (
        <View style={s.answer}>
          <AnalysisCards text={answer.analysis} />

          <Copy style={s.note}>
            Generado con {answer.model} ·{" "}
            {new Date(answer.generated_at).toLocaleString("es-CO")}
          </Copy>
        </View>
      )}

      <Copy style={s.note}>
        Si cambias los valores, genera un nuevo análisis. La IA explica los
        cálculos y puede equivocarse. Revisa sus recomendaciones; no realiza
        compras ni modifica tu inventario.
      </Copy>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    gap: 14,
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.mint,
    fontSize: 20,
    fontWeight: "700",
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
  },
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.mint,
  },
  buttonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  answer: {
    gap: 14,
  },
  error: {
    color: "#ffb4ab",
    fontSize: 14,
  },
});
