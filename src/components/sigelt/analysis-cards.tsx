import { Copy, colors } from "@/components/sigelt/primitives";
import { StyleSheet, Text, View } from "react-native";

type Section = {
  title: string;
  lines: string[];
};

export function parseAnalysis(value: string): Section[] {
  const sections: Section[] = [];
  let current: Section | undefined;

  for (const raw of value.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();

    if (!line || /^[-*_]{3,}$/.test(line)) continue;

    const candidate = line
      .replace(/^#{1,6}\s*/, "")
      .replace(/\*\*|__/g, "")
      .replace(/:$/, "")
      .trim();

    const heading =
      /^#{1,6}\s/.test(line) ||
      /^(Resumen|Alertas|Acciones sugeridas|Limitaciones)$/i.test(candidate);

    if (heading) {
      current = { title: candidate, lines: [] };
      sections.push(current);
    } else {
      if (!current) {
        current = { title: "Análisis", lines: [] };
        sections.push(current);
      }

      current.lines.push(line);
    }
  }

  return sections.filter((section) => section.lines.length > 0);
}

function RichText({ value }: { value: string }) {
  return (
    <Copy style={s.body}>
      {value.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).map((part, index) =>
        /^(\*\*|__)/.test(part) ? (
          <Text key={index} style={s.bold}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Copy>
  );
}

export function AnalysisCards({ text }: { text: string }) {
  return (
    <View style={s.grid}>
      {parseAnalysis(text).map((section, index) => {
        const alert = /alerta/i.test(section.title);
        const quiet = /limitaci/i.test(section.title);
        const wide = quiet || /resumen/i.test(section.title);

        const accent = alert ? "#e9c78f" : quiet ? colors.muted : colors.mint;

        return (
          <View
            key={index}
            style={[s.card, wide && s.wide, alert && s.alertCard]}
          >
            <View style={s.header}>
              <View style={[s.marker, { borderColor: accent }]}>
                <Copy
                  style={{
                    color: accent,
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </Copy>
              </View>

              <Copy
                accessibilityRole="header"
                headingLevel={3}
                style={[s.title, { color: accent }]}
              >
                {section.title}
              </Copy>
            </View>

            {section.lines.map((line, row) => {
              const bullet = /^(?:[-*•]|\d+[.)])\s+/.test(line);
              const content = line.replace(/^(?:[-*•]|\d+[.)])\s+/, "");

              return (
                <View key={row} style={[s.row, bullet && s.bulletRow]}>
                  {bullet && (
                    <View style={[s.dot, { backgroundColor: accent }]} />
                  )}

                  <View style={s.content}>
                    <RichText value={content} />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 0,
    padding: 20,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#151d17",
  },
  wide: {
    flexBasis: "100%",
  },
  alertCard: {
    backgroundColor: "#1d1d16",
    borderColor: "#45402d",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  marker: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    flexShrink: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  body: {
    fontSize: 14,
    lineHeight: 24,
    color: "#c6cfc7",
  },
  bold: {
    color: colors.text,
    fontWeight: "600",
  },
});
