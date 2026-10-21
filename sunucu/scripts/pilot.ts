import { startPilot } from "../src/pilot.js";
const pilot = await startPilot();
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    void pilot.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
