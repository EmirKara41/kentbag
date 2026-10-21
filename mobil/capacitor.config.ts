import type { CapacitorConfig } from "@capacitor/cli";
const lanHost = process.env.KENT_LAN_HOST;
const octets = lanHost?.split(".").map(Number);
if (
  lanHost &&
  !(
    octets?.length === 4 &&
    octets.every((p) => Number.isInteger(p) && p >= 0 && p <= 255) &&
    (octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31))
  )
)
  throw new Error("LAN pilot requires a private IPv4 address.");
const config: CapacitorConfig = {
  appId: "com.kentyanimda.vatandas",
  appName: "KentYanımda",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: {
    allowMixedContent: !!lanHost,
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
