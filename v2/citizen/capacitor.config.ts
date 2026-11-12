import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.kentbag.vatandas",
  appName: "KentBağ",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false, backgroundColor: "#eef2f4" },
};
export default config;
