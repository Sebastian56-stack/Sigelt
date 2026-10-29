import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Falta configurar la URL o la clave pública de Supabase en .env.local.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // En el navegador, Supabase utiliza su almacenamiento web.
    // En aplicaciones nativas, utiliza AsyncStorage.
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),

    persistSession: true,
    autoRefreshToken: true,

    // Permite procesar el regreso desde los enlaces del correo en la web.
    detectSessionInUrl: Platform.OS === "web",
  },
});
