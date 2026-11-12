import { test, expect } from "@playwright/test";
import { mockApi } from "./mock.ts";

test("demo button signs in as the center", async ({ page }) => {
  const calls = await mockApi(page, { role: "center", name: "Demo Belediye Merkezi" });
  await page.goto("/");
  await page.getByRole("button", { name: "Belediye merkezi" }).click();
  await expect(page.getByRole("heading", { name: "Bütün talepler" })).toBeVisible();
  expect(calls.some((c) => c.path === "/api/demo/login" && (c.body as any).key === "merkez")).toBeTruthy();
  await expect(page.getByRole("button", { name: "Trafo müdahale ekibi" })).toHaveCount(0);
});

test("crew accounts are told to use the app", async ({ page }) => {
  await mockApi(page, { role: "crew", name: "Demo Trafo" });
  await page.goto("/");
  await page.evaluate(() => sessionStorage.setItem("kb.token", "t"));
  await page.reload();
  await expect(page.getByText("Bu hesap web paneline giremez")).toBeVisible();
});

test("login screen fits a phone without horizontal scroll", async ({ page }) => {
  await mockApi(page, { role: "center", name: "x" });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Belediye merkezi" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});
