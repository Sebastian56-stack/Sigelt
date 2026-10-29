import type { User } from "@supabase/supabase-js";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Brand, Copy, colors, font } from "@/components/sigelt/primitives";
import { supabase } from "@/lib/supabase";

const svgSource = (svg: string) => ({
  uri: "data:image/svg+xml;utf8," + encodeURIComponent(svg),
});

const aurora = svgSource(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="700" viewBox="0 0 800 700">',
    "<defs>",
    '<linearGradient id="base" x2="1" y2="1"><stop stop-color="#14331f"/><stop offset="1" stop-color="#253e29"/></linearGradient>',
    '<radialGradient id="glow"><stop stop-color="#c9ffc0" stop-opacity=".85"/><stop offset=".45" stop-color="#80d28e" stop-opacity=".4"/><stop offset="1" stop-color="#80d28e" stop-opacity="0"/></radialGradient>',
    '<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#06120a" stop-opacity=".1"/><stop offset="1" stop-color="#06120a" stop-opacity=".8"/></linearGradient>',
    '<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="27"/></filter>',
    "</defs>",
    '<path fill="url(#base)" d="M0 0h800v700H0z"/>',
    '<ellipse cx="150" cy="180" rx="320" ry="300" fill="url(#glow)"/>',
    '<ellipse cx="730" cy="330" rx="310" ry="360" fill="url(#glow)"/>',
    '<g fill="none" filter="url(#blur)">',
    '<path d="M-90 310C100 60 250 430 460 270S720 100 900 260" stroke="#c0ffb8" stroke-width="75" opacity=".65"/>',
    '<path d="M-100 510C100 720 260 360 440 500S700 650 900 390" stroke="#8fe49c" stroke-width="60" opacity=".7"/>',
    "</g>",
    '<path fill="url(#shade)" d="M0 0h800v700H0z"/>',
    "</svg>",
  ].join(""),
);

const iconPaths = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
};

function LineIcon({
  name,
  size = 32,
}: {
  name: keyof typeof iconPaths;
  size?: number;
}) {
  return (
    <Image
      source={svgSource(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d8ead6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
          iconPaths[name] +
          "</svg>",
      )}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
      alt=""
    />
  );
}

const countries = [
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "BR", name: "Brasil", dial: "+55" },
  { code: "CA", name: "Canadá", dial: "+1" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "CR", name: "Costa Rica", dial: "+506" },
  { code: "CU", name: "Cuba", dial: "+53" },
  { code: "EC", name: "Ecuador", dial: "+593" },
  { code: "SV", name: "El Salvador", dial: "+503" },
  { code: "ES", name: "España", dial: "+34" },
  { code: "US", name: "Estados Unidos", dial: "+1" },
  { code: "GT", name: "Guatemala", dial: "+502" },
  { code: "HN", name: "Honduras", dial: "+504" },
  { code: "MX", name: "México", dial: "+52" },
  { code: "NI", name: "Nicaragua", dial: "+505" },
  { code: "PA", name: "Panamá", dial: "+507" },
  { code: "PY", name: "Paraguay", dial: "+595" },
  { code: "PE", name: "Perú", dial: "+51" },
  { code: "DO", name: "República Dominicana", dial: "+1" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "VE", name: "Venezuela", dial: "+58" },
];

type Mode = "login" | "signup";

function Field({
  label,
  secret = false,
  inputRef,
  ...props
}: TextInputProps & {
  label: string;
  secret?: boolean;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={s.fieldGroup}>
      <Copy style={s.label}>{label}</Copy>

      <View style={[s.field, focused && s.fieldFocused]}>
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor="#8e9c92"
          secureTextEntry={secret && !visible}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={s.input}
        />

        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible ? "Ocultar " + label : "Mostrar " + label
            }
            disabled={props.editable === false}
            onPress={() => setVisible((value) => !value)}
            style={s.reveal}
          >
            <Copy style={s.smallMint}>{visible ? "Ocultar" : "Ver"}</Copy>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function authMessage(code?: string, status?: number) {
  if (status === 429 || code === "over_email_send_rate_limit") {
    return "Se alcanzó el límite de intentos o correos. Espera antes de volver a intentar.";
  }

  switch (code) {
    case "invalid_credentials":
      return "El correo o la contraseña no son correctos.";
    case "email_not_confirmed":
      return "Abre el enlace de confirmación de tu correo antes de iniciar sesión.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo. Prueba iniciar sesión.";
    case "weak_password":
      return "Elige una contraseña más segura, de al menos 12 caracteres.";
    case "email_address_invalid":
      return "Revisa que el correo electrónico esté bien escrito.";
    case "email_address_not_authorized":
      return "El servicio de correo aún no permite enviar a esta dirección.";
    case "signup_disabled":
      return "El registro de cuentas no está disponible en este momento.";
    default:
      return "No pudimos completar la solicitud. Inténtalo de nuevo.";
  }
}

export default function AuthScreen() {
  const { width, height } = useWindowDimensions();
  const compact = width < 900;

  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = params.mode === "signup" ? "signup" : "login";
  const signup = mode === "signup";

  const [cardWidth, setCardWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [progress] = useState(() => new Animated.Value(signup ? 1 : 0));
  const firstInput = useRef<ComponentRef<typeof TextInput>>(null);
  const submitting = useRef(false);
  const moving = useRef(false);
  const [switching, setSwitching] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState(countries[0]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [countryOpen, setCountryOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const disabled = checking || busy || switching;

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setChecking(false);

      if (session) {
        setPendingEmail("");
        setMessage("");
      } else if (event === "INITIAL_SESSION" && Platform.OS === "web") {
        const params = new URLSearchParams(window.location.hash.slice(1));

        if (params.has("error")) {
          setMessage("El enlace de confirmación no es válido o ha vencido.");
        }
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReduceMotion(media.matches);

      update();
      media.addEventListener("change", update);

      return () => media.removeEventListener("change", update);
    }

    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduceMotion(value);
      })
      .catch(() => {});

    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      active = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: signup ? 1 : 0,
      duration: reduceMotion ? 0 : compact ? 280 : 600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });

    animation.start(({ finished }) => {
      if (!finished) return;

      const shouldFocus = moving.current;
      moving.current = false;
      setSwitching(false);

      if (shouldFocus && !compact) {
        firstInput.current?.focus();
      }
    });

    return () => animation.stop();
  }, [signup, compact, reduceMotion, progress]);

  function changeMode(next: Mode) {
    if (submitting.current || moving.current || checking) return;

    Keyboard.dismiss();
    setMessage("");
    setPendingEmail("");
    setPassword("");
    setConfirmation("");
    setCountryOpen(false);

    if (next === mode) return;

    moving.current = true;
    setSwitching(true);
    router.setParams({ mode: next });
  }

  async function submit() {
    if (submitting.current || moving.current || checking) return;

    if (pendingEmail && !user) {
      changeMode("login");
      return;
    }

    setMessage("");

    const cleanEmail = email.trim();
    const digits = phone.replace(/[\s().-]/g, "");
    const fullPhone = country.dial + digits;

    if (!user) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || !password) {
        setMessage("Escribe un correo válido y tu contraseña.");
        return;
      }

      if (signup) {
        if (!firstName.trim() || !lastName.trim()) {
          setMessage("Completa tus nombres y apellidos.");
          return;
        }

        if (!/^\d+$/.test(digits) || !/^\+[1-9]\d{7,14}$/.test(fullPhone)) {
          setMessage(
            "Revisa el teléfono: escribe el número sin repetir el indicativo.",
          );
          return;
        }

        if (password.length < 12) {
          setMessage("La contraseña debe tener al menos 12 caracteres.");
          return;
        }

        if (password !== confirmation) {
          setMessage("Las contraseñas no coinciden.");
          return;
        }
      }
    }

    submitting.current = true;
    setBusy(true);

    try {
      if (user) {
        router.replace("/inventario");
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo:
              Platform.OS === "web" && typeof window !== "undefined"
                ? window.location.origin + "/auth"
                : undefined,
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              country_code: country.code,
              phone: fullPhone,
            },
          },
        });

        if (error) {
          setMessage(authMessage(error.code, error.status));
        } else {
          setPassword("");
          setConfirmation("");

          if (!data.session) {
            setPendingEmail(cleanEmail);
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setMessage(authMessage(error.code, error.status));
        } else {
          setPassword("");
        }
      }
    } catch {
      setMessage(
        "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const formOpacity = progress.interpolate({
    inputRange: [0, 0.45, 0.55, 1],
    outputRange: signup ? [0, 0, 0, 1] : [1, 0, 0, 0],
  });

  const formX = compact
    ? progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, -16, 0],
      })
    : progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -cardWidth * 0.54],
      });

  const visualX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, cardWidth * 0.46],
  });

  return (
    <KeyboardAwareScrollView
      style={s.page}
      enabled={Platform.OS !== "web"}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentContainerStyle={[
        s.pageContent,
        {
          flexGrow: 1,
          minHeight: Platform.OS === "web" ? height : undefined,
          padding: compact ? 16 : 40,
        },
      ]}
    >
      <View
        style={s.card}
        onLayout={(event) =>
          setCardWidth(Math.max(0, event.nativeEvent.layout.width - 2))
        }
      >
        <Animated.View
          style={[
            s.visual,
            compact ? s.visualSmall : s.visualDesktop,
            !compact && {
              transform: [{ translateX: visualX }],
            },
          ]}
        >
          <Image
            source={aurora}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessible={false}
            alt=""
          />

          <View style={[s.visualContent, compact && s.visualContentSmall]}>
            <Brand />

            <View style={s.welcome}>
              <Copy style={s.eyebrow}>TODO EN SU LUGAR</Copy>

              <Copy style={[s.heroTitle, compact && s.heroTitleSmall]}>
                {signup ? "Todo empieza\ncontigo." : "Bienvenido."}
              </Copy>

              <Copy style={s.heroDescription}>
                {signup
                  ? "Crea tu cuenta y da el primer paso hacia una gestión más clara."
                  : "Tus productos, inventario y ventas.\nUn solo espacio para tenerlo todo claro."}
              </Copy>
            </View>

            <Copy style={s.visualFooter}>
              Sigelt · Claridad en cada movimiento.
            </Copy>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            s.formPanel,
            compact ? s.formSmall : s.formDesktop,
            {
              transform: [{ translateX: formX }],
            },
          ]}
        >
          <View style={s.header}>
            <Copy style={s.accessLabel}>SIGELT / ACCESO</Copy>

            <Link href="/" style={s.backLink}>
              Volver al inicio
            </Link>
          </View>

          <Animated.View style={[s.formBody, { opacity: formOpacity }]}>
            <View style={[s.avatar, signup && s.avatarSmall]}>
              <LineIcon
                name={pendingEmail ? "mail" : "user"}
                size={signup ? 30 : 44}
              />
            </View>

            <Copy accessibilityRole="header" headingLevel={1} style={s.title}>
              {user
                ? "Tu espacio está listo"
                : pendingEmail
                  ? "Revisa tu correo"
                  : signup
                    ? "Crear cuenta"
                    : "Iniciar sesión"}
            </Copy>

            <Copy style={s.subtitle}>
              {user
                ? "Has accedido con " + (user.email ?? "tu cuenta")
                : pendingEmail
                  ? "Un paso más para empezar."
                  : signup
                    ? "Un espacio para organizar lo que viene."
                    : "Tu espacio de trabajo te espera."}
            </Copy>

            {pendingEmail && !user ? (
              <View style={s.notice}>
                <Copy style={s.noticeText}>
                  Si {pendingEmail} puede registrarse, recibirás un enlace para
                  confirmar tu cuenta. Revisa también la carpeta de spam.
                </Copy>

                <Copy style={[s.noticeText, { marginTop: 12 }]}>
                  Si ya tenías una cuenta, puedes iniciar sesión.
                </Copy>
              </View>
            ) : !user ? (
              <View style={s.fields}>
                {signup && (
                  <>
                    <View style={[s.row, compact && s.column]}>
                      <View
                        style={[s.half, compact && { flex: 0, width: "100%" }]}
                      >
                        <Field
                          label="Nombres"
                          placeholder="Tus nombres"
                          inputRef={firstInput}
                          value={firstName}
                          onChangeText={setFirstName}
                          autoComplete="given-name"
                          autoCapitalize="words"
                          maxLength={80}
                          editable={!disabled}
                        />
                      </View>

                      <View
                        style={[s.half, compact && { flex: 0, width: "100%" }]}
                      >
                        <Field
                          label="Apellidos"
                          placeholder="Tus apellidos"
                          value={lastName}
                          onChangeText={setLastName}
                          autoComplete="family-name"
                          autoCapitalize="words"
                          maxLength={80}
                          editable={!disabled}
                        />
                      </View>
                    </View>

                    <View style={s.row}>
                      <View style={{ width: 116 }}>
                        <Copy style={s.label}>País</Copy>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            "Elegir país: " + country.name + ", " + country.dial
                          }
                          disabled={disabled}
                          onPress={() => {
                            Keyboard.dismiss();
                            setCountryOpen(true);
                          }}
                          style={({ pressed }) => [
                            s.countryButton,
                            pressed && s.pressed,
                          ]}
                        >
                          <Copy style={s.countryText}>
                            {country.code} {country.dial} ▾
                          </Copy>
                        </Pressable>
                      </View>

                      <View style={s.half}>
                        <Field
                          label="Teléfono"
                          placeholder="Número"
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                          autoComplete="tel-national"
                          maxLength={24}
                          editable={!disabled}
                        />
                      </View>
                    </View>

                    <Copy style={s.hint}>
                      Escribe el teléfono sin repetir el indicativo.
                    </Copy>
                  </>
                )}

                <Field
                  label="Correo electrónico"
                  placeholder="tu@correo.com"
                  inputRef={signup ? undefined : firstInput}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={254}
                  editable={!disabled}
                />

                <Field
                  key={mode + "-password"}
                  label="Contraseña"
                  secret
                  placeholder={
                    signup ? "Mínimo 12 caracteres" : "Tu contraseña"
                  }
                  value={password}
                  onChangeText={setPassword}
                  autoComplete={signup ? "new-password" : "current-password"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!disabled}
                  onSubmitEditing={signup ? undefined : () => void submit()}
                />

                {signup && (
                  <Field
                    label="Confirmar contraseña"
                    secret
                    placeholder="Repite tu contraseña"
                    value={confirmation}
                    onChangeText={setConfirmation}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!disabled}
                    onSubmitEditing={() => void submit()}
                  />
                )}
              </View>
            ) : null}

            {message ? (
              <Copy accessibilityRole="alert" style={s.message}>
                {message}
              </Copy>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled,
                busy: checking || busy,
              }}
              disabled={disabled}
              onPress={() => void submit()}
              style={({ pressed }) => [
                s.submit,
                (pressed || disabled) && s.pressed,
              ]}
            >
              {(checking || busy) && (
                <ActivityIndicator size="small" color={colors.ink} />
              )}

              <Copy style={s.submitText}>
                {checking
                  ? "Comprobando…"
                  : busy
                    ? "Un momento…"
                    : user
                      ? "Entrar a Sigelt"
                      : pendingEmail
                        ? "Volver a iniciar sesión"
                        : signup
                          ? "Crear mi cuenta"
                          : "Entrar a Sigelt"}
              </Copy>
            </Pressable>

            {!user && !pendingEmail && (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => changeMode(signup ? "login" : "signup")}
                style={({ pressed }) => [s.switchButton, pressed && s.pressed]}
              >
                <Copy style={s.switchText}>
                  {signup ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}
                  <Copy style={s.switchAccent}>
                    {signup ? "Inicia sesión" : "Crear cuenta"}
                  </Copy>
                </Copy>
              </Pressable>
            )}
          </Animated.View>

          <Copy style={s.footer}>Tu inventario, en orden.</Copy>
        </Animated.View>
      </View>

      <Modal
        visible={countryOpen}
        transparent
        animationType={reduceMotion ? "none" : "fade"}
        onRequestClose={() => setCountryOpen(false)}
      >
        <View style={s.modalShade}>
          <View style={s.modalCard} accessibilityViewIsModal>
            <View style={s.header}>
              <Copy accessibilityRole="header" style={s.modalTitle}>
                Elige tu país
              </Copy>

              <Pressable
                accessibilityRole="button"
                onPress={() => setCountryOpen(false)}
                style={s.close}
              >
                <Copy style={s.smallMint}>Cerrar</Copy>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: Math.min(420, height * 0.55) }}>
              {countries.map((item) => (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: country.code === item.code,
                  }}
                  onPress={() => {
                    setCountry(item);
                    setCountryOpen(false);
                  }}
                  style={({ pressed }) => [
                    s.countryOption,
                    country.code === item.code && s.selected,
                    pressed && s.pressed,
                  ]}
                >
                  <Copy style={s.countryText}>
                    {item.name} ({item.code})
                  </Copy>
                  <Copy style={s.smallMint}>{item.dial}</Copy>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#080e0a",
  },
  pageContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 1140,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#344738",
    backgroundColor: "#0b140e",
  },
  visual: {
    backgroundColor: "#1b3825",
  },
  visualDesktop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "54%",
  },
  visualSmall: {
    minHeight: 230,
  },
  visualContent: {
    flex: 1,
    padding: 42,
    justifyContent: "space-between",
    gap: 34,
  },
  visualContentSmall: {
    padding: 26,
    gap: 24,
  },
  welcome: {
    paddingVertical: 28,
  },
  eyebrow: {
    color: "#d2eacb",
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 58,
    lineHeight: 66,
    fontWeight: "700",
    letterSpacing: -2.5,
  },
  heroTitleSmall: {
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.5,
  },
  heroDescription: {
    color: "#e1ece0",
    fontSize: 15,
    lineHeight: 25,
    marginTop: 16,
  },
  visualFooter: {
    color: "#c0d0bf",
    fontSize: 12,
  },
  formPanel: {
    backgroundColor: "#0b140e",
    zIndex: 1,
    padding: 32,
  },
  formDesktop: {
    width: "46%",
    marginLeft: "54%",
    minHeight: 650,
  },
  formSmall: {
    width: "100%",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  accessLabel: {
    color: "#a6b4a6",
    fontSize: 10,
    letterSpacing: 1,
  },
  backLink: {
    color: "#d5e4d1",
    fontFamily: font,
    fontSize: 12,
    paddingVertical: 12,
  },
  formBody: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "#a6bda2",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  avatarSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 12,
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#a6b4a6",
    textAlign: "center",
    marginTop: 6,
  },
  fields: {
    marginTop: 22,
    gap: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  column: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  fieldGroup: {
    width: "100%",
  },
  label: {
    fontSize: 12,
    lineHeight: 20,
    color: "#c6d5c2",
    marginBottom: 6,
    marginLeft: 4,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#50644e",
    borderRadius: 16,
    paddingHorizontal: 13,
    backgroundColor: "#0e1b12",
  },
  fieldFocused: {
    borderColor: colors.mint,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 11,
    color: colors.text,
    fontFamily: font,
    fontSize: 15,
    backgroundColor: "transparent",
  },
  reveal: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  smallMint: {
    color: colors.mint,
    fontSize: 12,
  },
  hint: {
    color: "#a6b4a6",
    fontSize: 11,
    lineHeight: 18,
    marginTop: -5,
  },
  countryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#50644e",
    borderRadius: 16,
    backgroundColor: "#0e1b12",
    alignItems: "center",
    justifyContent: "center",
  },
  countryText: {
    fontSize: 14,
  },
  message: {
    fontSize: 13,
    lineHeight: 21,
    color: "#f1f5f0",
    marginTop: 18,
  },
  notice: {
    padding: 20,
    marginTop: 22,
    backgroundColor: "#16251a",
    borderRadius: 16,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 23,
    color: "#d1dfcd",
  },
  submit: {
    minHeight: 50,
    marginTop: 24,
    padding: 12,
    borderRadius: 25,
    backgroundColor: colors.mint,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  pressed: {
    opacity: 0.65,
  },
  switchButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  switchText: {
    color: "#a6b4a6",
    fontSize: 13,
    textAlign: "center",
  },
  switchAccent: {
    color: colors.mint,
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    fontSize: 11,
    textAlign: "center",
    color: "#a6b4a6",
  },
  modalShade: {
    flex: 1,
    padding: 24,
    backgroundColor: "#000000bb",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#50644e",
    padding: 20,
    backgroundColor: "#111c14",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  close: {
    minHeight: 44,
    minWidth: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  countryOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    minHeight: 48,
    borderRadius: 10,
  },
  selected: {
    backgroundColor: "#293c2c",
  },
});
