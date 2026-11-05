import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.kentbag.saha",
  appName: "KentBağ Saha",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false, backgroundColor: "#f2f5f1" },
  plugins: {
    SystemBars: { style: "DARK", insetsHandling: "css" },
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#f2f5f1",
      showSpinner: false,
    },
  },
};
export default config;
