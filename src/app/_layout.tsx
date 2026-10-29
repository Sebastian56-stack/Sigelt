import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import "@/global.css";

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#090b0a" }}
        edges={Platform.OS === "web" ? [] : ["top", "bottom", "left", "right"]}
      >
        <StatusBar style="light" />

        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </SafeAreaView>
    </KeyboardProvider>
  );
}
