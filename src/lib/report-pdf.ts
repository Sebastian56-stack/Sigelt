import { buildReportHtml } from "@/lib/report-pdf-html";
import type { VisualMonthlyReport } from "@/lib/visual-reports";
import { Platform } from "react-native";

function printInBrowser(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    document.getElementById("sigelt-pdf-frame")?.remove();

    const frame = document.createElement("iframe");
    frame.id = "sigelt-pdf-frame";
    frame.title = "Informe mensual de Sigelt";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");

    frame.style.cssText =
      "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;";

    const timer = setTimeout(() => {
      frame.remove();
      reject(new Error("No se pudo abrir el documento. Intenta de nuevo."));
    }, 15000);

    frame.onload = () => {
      clearTimeout(timer);

      try {
        const target = frame.contentWindow;

        if (!target) {
          throw new Error("No se pudo preparar el PDF.");
        }

        target.addEventListener("afterprint", () => frame.remove(), {
          once: true,
        });

        target.focus();
        target.print();
        resolve();
      } catch (error) {
        frame.remove();
        reject(error);
      }
    };

    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

export async function exportMonthlyPdf(report: VisualMonthlyReport) {
  // Conserva las cifras que estaban en pantalla al pulsar el botón.
  const snapshot = JSON.parse(JSON.stringify(report)) as VisualMonthlyReport;

  const html = buildReportHtml(snapshot, Platform.OS === "ios");

  if (Platform.OS === "web") {
    if (typeof document === "undefined") {
      throw new Error("Abre el informe en el navegador para exportarlo.");
    }

    await printInBrowser(html);
    return;
  }

  const Print = await import("expo-print");
  const Sharing = await import("expo-sharing");
  const { File, Paths } = await import("expo-file-system");

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Este dispositivo no permite compartir archivos.");
  }

  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    margins: {
      top: 40,
      bottom: 40,
      left: 40,
      right: 40,
    },
  });

  const name =
    "Sigelt_Informe_" +
    snapshot.period.month.slice(0, 7) +
    "_" +
    Date.now() +
    ".pdf";

  const file = new File(uri);
  const destination = new File(Paths.cache, name);

  await file.move(destination);

  await Sharing.shareAsync(destination.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Guardar o compartir informe de Sigelt",
  });
}
