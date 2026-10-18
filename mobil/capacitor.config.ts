import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.kentyanimda.vatandas",
  appName: "KentYanımda",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f7f8fa",
    appendUserAgent: " KentYanimda/1.0 (Android)",
  },
  plugins: {
    SystemBars: { style: "DARK", insetsHandling: "css" },
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#f7f8fa",
      androidSplashResourceName: "kent_splash",
      showSpinner: false,
    },
    Keyboard: { resize: "body" },
  },
};
export default config;
