import type { CitizenReport } from "./domain";

// What the municipality center is expected to do next on a report.
// Crew assignment and field work belong to the institution and its crew.
export type CenterStep = "forward" | "waiting" | "publish" | "reopen" | "none";

const activeOrders = (report: CitizenReport) =>
  (report.fieldOrders ?? []).filter((order) => order.state === "prepared");

export function centerStep(report: CitizenReport): CenterStep {
  if (report.status === "withdrawn") return "none";
  if (["resolved", "closed"].includes(report.status)) return "reopen";
  if (activeOrders(report).some((order) => order.crewState === "center_review"))
    return "publish";
  const delivery = report.institutionDelivery;
  if (delivery && delivery.state !== "returned") return "waiting";
  return "forward";
}

// A field result is waiting for institution or center review; the server
// refuses a direct center resolution while it is pending.
export const fieldResultPending = (report: CitizenReport) =>
  activeOrders(report).some((order) => !!order.result);

export const flowLabels = [
  "Alındı",
  "Kuruma gönderildi",
  "Kurum ve ekip çalışıyor",
  "Merkez onayı",
  "Çözüm bildirildi",
] as const;

export type FlowState = "done" | "current" | "skipped" | "todo";

export function flowStates(report: CitizenReport): FlowState[] {
  const step = centerStep(report);
  const delivery = report.institutionDelivery;
  const working =
    delivery?.state === "accepted" || activeOrders(report).length > 0;
  const current =
    step === "reopen"
      ? 4
      : step === "publish"
        ? 3
        : step === "waiting"
          ? working
            ? 2
            : 1
          : 0;
  // Closed without a published field result: the middle steps never happened.
  const published = (report.fieldOrders ?? []).some(
    (order) => order.crewState === "published",
  );
  return flowLabels.map((_, index) => {
    if (index === current) return "current";
    if (index > current) return "todo";
    if (step === "reopen" && !published && index > 0) {
      if (index === 1 && delivery) return "done";
      return "skipped";
    }
    return "done";
  });
}
