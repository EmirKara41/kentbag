import { test, expect } from "@playwright/test";
import { mockApi, sampleRequest } from "./mock.ts";

const routed = { ...sampleRequest, status: "routed", statusLabel: "Elektrik Dağıtımı'na iletildi", institution: "electricity", institutionName: "Elektrik Dağıtımı" };
const teams = [
  { id: "elk-trafo", name: "Trafo müdahale ekibi", institution: "electricity", institutionName: "Elektrik Dağıtımı", onShift: true, active: true, locatedAt: null, jobs: [] },
  { id: "elk-bakim", name: "Şebeke bakım ekibi", institution: "electricity", institutionName: "Elektrik Dağıtımı", onShift: false, active: true, locatedAt: null, jobs: [] },
];

async function open(page: import("@playwright/test").Page) {
  const calls = await mockApi(page, { role: "institution", name: "Elektrik", institution: "electricity" }, async (route, path, method) => {
    const json = (d: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify(d) });
    if (path === "/api/staff/requests") return json({ requests: [routed] }).then(() => true);
    if (path === "/api/staff/teams") return json({ teams }).then(() => true);
    if (path.endsWith("/suggest") && method === "POST")
      return json({ institution: "electricity", teamId: "elk-trafo", reason: "Trafo müdahale ekibi seçildi: sırada 1. iş, tahmini varış 14:30." }).then(() => true);
    return false;
  });
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("kb.token", "t"));
  await page.reload();
  return calls;
}

test("waiting request: apply the agent's suggestion", async ({ page }) => {
  const calls = await open(page);
  await expect(page.getByRole("heading", { name: "Elektrik Dağıtımı" })).toBeVisible();
  const card = page.locator(".card", { hasText: "Elektrik kesintisi" });
  await expect(card).toContainText("Trafo müdahale ekibi seçildi");
  await card.getByRole("button", { name: "Öneriyi uygula" }).click();
  await expect.poll(() => calls.find((c) => c.path.endsWith("/assign"))?.body).toEqual({ teamId: "elk-trafo" });
});

test("team board shows shift state and can close a team", async ({ page }) => {
  const calls = await open(page);
  const bakim = page.locator(".team", { hasText: "Şebeke bakım ekibi" });
  await expect(bakim).toContainText("Mesai dışı");
  await page.locator(".team", { hasText: "Trafo müdahale ekibi" }).getByRole("button", { name: "Ekibi kapat" }).click();
  await expect.poll(() => calls.find((c) => c.method === "PATCH")?.body).toEqual({ active: false });
});
