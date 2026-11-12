import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.kentbag.ekip",
  appName: "KentBağ Ekip",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false, backgroundColor: "#1d262b" },
};
export default config;
