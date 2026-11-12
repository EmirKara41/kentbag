import { test, expect } from "@playwright/test";
import { mockApi } from "./mock.ts";

test("received request: suggestion preselected, Yönlendir sends the institution", async ({ page }) => {
  const calls = await mockApi(page, { role: "center", name: "Merkez" }, async (route, path, method) => {
    if (path.endsWith("/suggest") && method === "POST") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ institution: "electricity", teamId: "elk-trafo", reason: "Trafo müdahale ekibi seçildi: sırada 1. iş." }) });
      return true;
    }
    return false;
  });
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("kb.token", "t"));
  await page.reload();
  await page.getByRole("button", { name: /Elektrik kesintisi/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Hangi kuruma gitsin?");
  await page.getByRole("button", { name: "Yönlendir" }).click();
  await expect.poll(() => calls.find((c) => c.path.endsWith("/route"))?.body).toEqual({ institution: "electricity" });
});

test("agent switch sends the new value", async ({ page }) => {
  const calls = await mockApi(page, { role: "center", name: "Merkez" });
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("kb.token", "t"));
  await page.reload();
  await page.getByRole("button", { name: "Ajan · Tüm sistem" }).click();
  await expect.poll(() => calls.find((c) => c.path === "/api/staff/agent" && c.method === "PUT")?.body).toEqual({ center: false });
});

test("counters filter the list and sweep runs", async ({ page }) => {
  const calls = await mockApi(page, { role: "center", name: "Merkez" });
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("kb.token", "t"));
  await page.reload();
  await expect(page.getByRole("button", { name: /Onay bekleyen/ })).toContainText("1");
  await expect.poll(() => calls.some((c) => c.path === "/api/agent/sweep")).toBeTruthy();
});
