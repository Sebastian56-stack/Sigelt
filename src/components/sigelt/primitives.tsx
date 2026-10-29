import { Image } from 'expo-image';
import { useState, type PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';

export const colors = { bg: '#090b0a', panel: '#111513', elevated: '#181d1a', border: '#29312b', text: '#f1f5f0', muted: '#a0aaa3', mint: '#b6f3b0', ink: '#142110' };
export const font = Platform.OS === 'web' ? '"Inter", "Segoe UI", system-ui, sans-serif' : undefined;

const paths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  box: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chart: '<path d="M4 3v17h17M8 15v-4m5 4V6m5 9V9"/>',
  spark: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM9 7h6M9 11h6M9 15h3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  book: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M12 8h4M12 12h4"/>',
  pencil: '<path d="m4 16-1 5 5-1L21 7l-4-4L4 16ZM14 6l4 4M4 16l4 4"/>',
  paper: '<path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M9 12h6M9 16h6"/>',
  entry: '<path d="M4 8V4h16v4M4 13v7h16v-7M12 3v12m-4-4 4 4 4-4"/>',
  link: '<path d="m9 15 6-6m-7 3-2 2a4 4 0 0 0 6 6l2-2m-4-12 2-2a4 4 0 0 1 6 6l-2 2"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v.1"/>',
  logo: '<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
} as const;
export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, color = colors.muted }: { name: IconName; size?: number; color?: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  return <Image source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ width: size, height: size, flexShrink: 0 }} contentFit="contain" accessible={false} alt="" />;
}

export function Copy({ children, style, headingLevel = 2, ...rest }: PropsWithChildren<{ style?: StyleProp<TextStyle>; headingLevel?: 1 | 2 | 3 }> & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const headingProps = Platform.OS === 'web' && rest.accessibilityRole === 'header' ? { 'aria-level': headingLevel } : {};
  return <Text {...rest} {...headingProps} style={[{ fontFamily: font, color: colors.text, fontSize: 16, lineHeight: 25 }, style]}>{children}</Text>;
}

export function Brand({ small = false }: { small?: boolean }) {
  return <View style={s.row}><Icon name="logo" color={colors.mint} size={small ? 23 : 29} /><Copy style={{ fontSize: small ? 23 : 27, fontWeight: '600', letterSpacing: -1.2 }}>sigelt<Copy style={{ color: colors.mint, fontSize: 27 }}>.</Copy></Copy></View>;
}

export function Action({ children, onPress, secondary = false, icon = 'arrow', label, small = false, style }: PropsWithChildren<{ onPress: () => void; secondary?: boolean; icon?: IconName; label?: string; small?: boolean; style?: StyleProp<ViewStyle> }>) {
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} testID="action" style={({ pressed }) => [s.action, { backgroundColor: secondary ? (hover ? '#202820' : 'transparent') : (hover ? '#ceffc9' : colors.mint), borderColor: secondary ? '#384238' : 'transparent', paddingVertical: small ? 10 : 14, paddingHorizontal: small ? 17 : 24, opacity: pressed ? 0.8 : 1 }, style]}>
    <Copy style={{ color: secondary ? colors.text : colors.ink, fontWeight: '600', fontSize: small ? 14 : 15 }}>{children}</Copy><Icon name={icon} size={18} color={secondary ? colors.mint : colors.ink} />
  </Pressable>;
}

export function Eyebrow({ children }: PropsWithChildren) { return <Copy style={s.eyebrow}>{children}</Copy>; }
export function Badge({ children, mint = false }: PropsWithChildren<{ mint?: boolean }>) { return <View style={[s.badge, mint && { borderColor: '#354d35', backgroundColor: '#1b2a1c' }]}><Copy style={{ fontSize: 12, lineHeight: 18, color: mint ? colors.mint : '#bbc3bc' }}>{children}</Copy></View>; }
export function SectionTitle({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) { return <Copy accessibilityRole="header" style={{ fontSize: compact ? 36 : 48, lineHeight: compact ? 42 : 55, letterSpacing: -1.9, fontWeight: '500' }}>{children}</Copy>; }
export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { borderWidth: 1, borderRadius: 99, flexDirection: 'row', gap: 14, alignItems: 'center', justifyContent: 'center', minHeight: 46, alignSelf: 'flex-start' },
  eyebrow: { color: colors.mint, fontSize: 12, lineHeight: 20, fontWeight: '600', letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 20 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#343c35', borderRadius: 99, alignSelf: 'flex-start' },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 27 },
  panel: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.panel },
});
