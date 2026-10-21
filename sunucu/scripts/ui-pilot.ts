// Isolated browser verification database, never mixed into the normal pilot's receipts.
import { startPilot } from "../src/pilot.js";
const pilot = await startPilot({
  dataDir: ".local/ui-verification",
  host: "127.0.0.1",
  port: 4323,
  pgPort: 5441,
  listenHost: "127.0.0.1",
  panelOrigin: "http://localhost:4281",
  webOrigins: ["http://localhost:4174"],
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void pilot.close().then(() => process.exit(0)));
