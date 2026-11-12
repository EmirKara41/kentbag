import { test, expect, type Page, type Route } from "@playwright/test";

type Me = { role: string; name: string; institution?: string };
const accounts = [
  { key: "merkez", label: "Belediye merkezi", role: "center", app: "web" },
  { key: "kurum-electricity", label: "Elektrik Dağıtımı", role: "institution", app: "web", institution: "electricity" },
  { key: "elk-trafo", label: "Trafo müdahale ekibi", role: "crew", app: "crew" },
];
const now = new Date().toISOString();
export const sampleRequest = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "KB-ABC123",
  kind: "issue",
  category: "electricity",
  categoryName: "Elektrik kesintisi",
  priority: "high",
  status: "received",
  statusLabel: "Alındı",
  institution: null,
  institutionName: null,
  teamId: null,
  teamName: null,
  queuePosition: null,
  address: "Cumhuriyet Mah.",
  point: { lat: 40.546, lng: 41.994 },
  description: "Sokakta elektrik yok.",
  etaArrival: null,
  etaFinish: null,
  agentReason: null,
  createdAt: now,
  updatedAt: now,
};

export async function mockApi(page: Page, me: Me, extra: (route: Route, path: string, method: string) => Promise<boolean> = async () => false) {
  const calls: { path: string; method: string; body: unknown }[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = route.request().postDataJSON?.() ?? null;
    calls.push({ path: url.pathname, method, body });
    if (await extra(route, url.pathname, method)) return;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (url.pathname === "/api/demo/accounts") return json({ accounts });
    if (url.pathname === "/api/demo/login") return json({ token: "t", role: me.role, app: "web" });
    if (url.pathname === "/api/me") return json(me);
    if (url.pathname === "/api/staff/requests") return json({ requests: [sampleRequest] });
    if (url.pathname.startsWith("/api/staff/requests/") && method === "GET")
      return json({ request: { ...sampleRequest, photos: [], resolutionPhotos: [], events: [{ id: "e1", status: "received", type: "created", body: "Talebin alındı.", public: true, actorRole: "citizen", at: now }] } });
    if (url.pathname === "/api/staff/agent")
      return json({ center: true, institutions: { electricity: true, water: true, cleaning: true, "public-works": true, parks: true } });
    if (url.pathname === "/api/staff/teams") return json({ teams: [] });
    if (url.pathname === "/api/agent/sweep") return json({ processed: 0 });
    return json({});
  });
  return calls;
}

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
