import { Copy, colors } from "@/components/sigelt/primitives";
import { exportMonthlyPdf } from "@/lib/report-pdf";
import type { VisualMonthlyReport } from "@/lib/visual-reports";
import { useEffect, useRef, useState } from "react";

import { ActivityIndicator, Platform, Pressable, View } from "react-native";

export function ReportPdfButton({ report }: { report: VisualMonthlyReport }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  async function download() {
    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setError("");

    try {
      await exportMonthlyPdf(report);
    } catch (err) {
      if (mounted.current) {
        setError(
          err instanceof Error ? err.message : "No pudimos preparar el PDF.",
        );
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  return (
    <View style={{ gap: 8, alignItems: "flex-start" }}>
      <Pressable
        onPress={download}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        style={({ pressed }) => ({
          minHeight: 46,
          paddingVertical: 11,
          paddingHorizontal: 20,
          borderRadius: 24,
          backgroundColor: colors.mint,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          opacity: busy || pressed ? 0.65 : 1,
        })}
      >
        {busy && <ActivityIndicator color={colors.ink} />}

        <Copy
          style={{
            color: colors.ink,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {busy ? "Preparando PDF…" : "Descargar PDF"}
        </Copy>
      </Pressable>

      <Copy
        style={{
          fontSize: 12,
          lineHeight: 20,
          color: colors.muted,
        }}
      >
        {Platform.OS === "web"
          ? "En la ventana de impresión, elige Guardar como PDF."
          : "Se abrirán las opciones para guardar o compartir el PDF."}
      </Copy>

      {error ? (
        <Copy
          accessibilityRole="alert"
          style={{ color: "#ffb4ab", fontSize: 13 }}
        >
          {error}
        </Copy>
      ) : null}
    </View>
  );
}
