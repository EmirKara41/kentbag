import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ request }) => {
  // Every scenario gets its own rate-limit window; production limits stay enabled.
  expect(
    (await request.post("http://localhost:4311/__test/reset-auth-limit")).ok(),
  ).toBeTruthy();
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
  "base64",
);
async function register(page: Page, email: string) {
  await page
    .getByRole("button", { name: "Hesap oluştur", exact: true })
    .click();
  await page.getByLabel("Ad soyad", { exact: true }).fill("Deniz Kaya");
  await page.getByLabel("E-posta adresi", { exact: true }).fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill("Guvenli-test-12345");
  await page
    .getByRole("button", { name: "Hesabımı oluştur", exact: true })
    .click();
}
async function prepare(page: Page, photo = false) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Yol hasarı bildir", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Sorun açıklaması" })
    .fill("Sokağın girişinde derin bir çukur oluşmuş.");
  if (photo) {
    await page
      .locator('input[aria-label="Galeriden fotoğraf seç"]')
      .setInputFiles({ name: "yol.png", mimeType: "image/png", buffer: png });
    await expect(page.getByAltText("Bildirime eklenen fotoğraf")).toHaveCount(
      1,
    );
  }
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page
    .getByRole("button", { name: "Mevcut konumumu kullan", exact: true })
    .click();
  await expect(
    page.getByText("40.54500, 41.99400", { exact: true }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Sokak, bina veya yakındaki bir yer")
    .fill("Parkın girişindeki sokak");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByText("Son bir göz atalım.", { exact: true }),
  ).toBeVisible();
}
test("installed-app journey: prepare as guest, sign up, real API upload and receipt, notes, session restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await prepare(page, true);
  await page
    .getByRole("button", { name: "Giriş yap ve devam et", exact: true })
    .click();
  await register(page, `journey-${Date.now()}@example.test`);
  await expect(
    page.getByRole("button", { name: "Bildirimi gönder", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bildirimi gönder", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bildirimin kaydedildi.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Belediye merkezi bağlantısı henüz açık değil.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Bildirime eklenen fotoğraf")
        .evaluateAll(
          (images) =>
            images.filter(
              (image) => (image as HTMLImageElement).naturalWidth > 0,
            ).length,
        ),
    )
    .toBe(1);
  await page
    .getByLabel("Talebine bir not ekle")
    .fill("Çukur bugün daha da büyüdü.");
  await page.getByRole("button", { name: "Notu kaydet", exact: true }).click();
  await expect(
    page.getByText("Çukur bugün daha da büyüdü.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/talep-detay.png",
    animations: "disabled",
  });
  await page.reload();
  await expect(page.locator(".header-avatar")).toHaveText("D");
  await page
    .getByRole("navigation", { name: "Ana gezinme" })
    .getByRole("button", { name: "Kayıtlarım", exact: true })
    .click();
  await expect(page.locator(".report-card")).toHaveCount(1);
  await expect(page.getByText("Kaydedilmiş taslağın")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("draft survives restart and all five tabs remain inside the app", async ({
  page,
}) => {
  await page.goto("/");
  await page.screenshot({
    path: "artifacts/ana-sayfa.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Su kesintisi bildir", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Sorun açıklaması" })
    .fill("Sabah saatlerinden beri sokağımızda su kesintisi var.");
  await page.getByRole("button", { name: "Geri", exact: true }).click();
  await page
    .getByRole("button", { name: "Taslağı kaydet ve çık", exact: true })
    .click();
  await page.reload();
  await page
    .getByText("Yarım kalan bir bildirimin var", { exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Sorun açıklaması" }),
  ).toHaveValue("Sabah saatlerinden beri sokağımızda su kesintisi var.");
  await expect(
    page.getByRole("radio", { name: "Su kesintisi", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Geri", exact: true }).click();
  await page
    .getByRole("button", { name: "Taslağı kaydet ve çık", exact: true })
    .click();
  for (const name of ["Kayıtlarım", "Mahallem", "Hesabım", "Ana sayfa"]) {
    await page
      .getByRole("navigation", { name: "Ana gezinme" })
      .getByRole("button", { name, exact: true })
      .click();
  }
  expect(new URL(page.url()).pathname).toBe("/");
});

test("example community support is local, persists once, and never becomes a personal report", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Bölgeni değiştir" }).click();
  await page.getByLabel("Mahalle veya bölge").fill("Deniz Mahallesi");
  await page.getByRole("button", { name: "Bölgeyi kaydet" }).click();
  await expect(
    page.getByRole("button", { name: "Bölgeni değiştir" }),
  ).toContainText("Deniz Mahallesi");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mahallem", exact: true })
    .click();
  await page.getByRole("button", { name: "İstekler", exact: true }).click();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", {
        name: "Sağlık merkezi önüne erişilebilir geçiş",
        exact: true,
      }),
    })
    .click();
  await expect(
    page.getByText("Canlı kurum verisi değildir.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bu isteği destekle", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Desteğini geri al" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Takibi bırak" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Mahallem", exact: true })
    .click();
  await page.getByRole("button", { name: "İstekler", exact: true }).click();
  await page.getByLabel("Yalnızca takip ettiklerim").check();
  await expect(page.locator(".community-card")).toHaveCount(1);
  await page.screenshot({
    path: "artifacts/mahallem-istekler.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Örnek içerikleri gizle" }).click();
  await expect(page.locator(".community-card")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Gerçek kesinti duyurusu değildir.", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kayıtlarım", exact: true })
    .click();
  await expect(page.locator(".report-card")).toHaveCount(0);
});

test("improvement request preserves category through auth and actual submission", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Bir fikrim var", exact: false })
    .click();
  await page
    .getByRole("radio", { name: "Erişilebilirlik düzenlemesi", exact: true })
    .click();
  await page
    .getByLabel("Sorun açıklaması")
    .fill("Sağlık merkezinin girişine erişilebilir bir rampa gerekiyor.");
  await expect(page.locator(".impact-options")).toHaveCount(0);
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page.getByRole("button", { name: "Mevcut konumumu kullan" }).click();
  await expect(
    page.getByText("40.54500, 41.99400", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByText("İYİLEŞTİRME İSTEĞİ", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Giriş yap ve devam et" }).click();
  await register(page, `improvement-${Date.now()}@example.test`);
  const sent = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/reports") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Bildirimi gönder", exact: true })
    .click();
  const report = await (await sent).json();
  expect(report.kind).toBe("improvement");
  expect(report.category).toBe("accessibility");
  expect(report.impacts).toEqual([]);
  await expect(
    page.getByRole("heading", { name: "Bildirimin kaydedildi." }),
  ).toBeVisible();
});

test("completed archive persists, excludes withdrawn reports, and records unresolved feedback", async ({
  page,
  request,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "Giriş yap ve devam et" }).click();
  await register(page, `archive-${Date.now()}@example.test`);
  const receipt = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/reports") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Bildirimi gönder", exact: true })
    .click();
  const report = await (await receipt).json();
  const bearer = await page.evaluate(() =>
    sessionStorage.getItem("kent.preview.session"),
  );
  const headers = { Authorization: `Bearer ${bearer}` };
  const withdrawn = await request.post("http://localhost:4311/api/reports", {
    headers,
    data: {
      requestId: "withdraw-me",
      category: "waste",
      description: "Bu kayıt test sırasında geri çekilecek.",
      location: {
        latitude: 40.545,
        longitude: 41.994,
        address: "Test",
        source: "map",
      },
      photos: [],
    },
  });
  expect(withdrawn.ok()).toBeTruthy();
  expect(
    (
      await request.post(
        `http://localhost:4311/api/reports/${(await withdrawn.json()).id}/withdraw`,
        { headers },
      )
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(`http://localhost:4311/__test/resolve/${report.id}`, {
        headers,
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await page
    .getByRole("button", { name: "Tamamlanan taleplerim", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tamamlanan taleplerim", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".report-card")).toHaveCount(1);
  await expect(page.locator(".record-summary .completed strong")).toHaveText(
    "1",
  );
  await page.screenshot({
    path: "artifacts/tamamlanan-taleplerim.png",
    animations: "disabled",
  });
  await page.locator(".report-card").click();
  await page
    .getByRole("button", { name: "Sorun devam ediyor", exact: true })
    .click();
  await page
    .getByLabel("Geri dönüş açıklaması", { exact: false })
    .fill("Çukurun bir kısmı hâlâ duruyor.");
  await page.getByRole("button", { name: "Geri dönüşümü kaydet" }).click();
  await expect(
    page.getByRole("heading", { name: "Sorunun devam ettiğini bildirdin." }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Tamamlanan taleplerim", exact: false })
    .click();
  await expect(page.locator(".report-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Devam eden", exact: true }).click();
  await expect(page.locator(".report-card")).toHaveCount(1);
  await expect(page.locator(".report-card")).toContainText(
    "Sorun devam ediyor",
  );
});

test("nearby known incident can be opened without losing the report draft", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Su kesintisi bildir", exact: true })
    .click();
  await page
    .getByLabel("Sorun açıklaması")
    .fill("Bugün öğle saatlerinden beri evimizde su kesik.");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page.getByRole("button", { name: "Mevcut konumumu kullan" }).click();
  await page.locator(".incident-match button").click();
  await expect(
    page.getByRole("heading", {
      name: "Şebeke arızası nedeniyle su kesintisi",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ben de etkileniyorum", exact: true })
    .click();
  await page.getByRole("button", { name: "Geri", exact: true }).click();
  await expect(
    page.getByText("40.54500, 41.99400", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Geri", exact: true }).click();
  await expect(page.getByLabel("Sorun açıklaması")).toHaveValue(
    "Bugün öğle saatlerinden beri evimizde su kesik.",
  );
});
test("lost server receipt preserves draft and retry creates a single report", async ({
  page,
}) => {
  await prepare(page);
  await page
    .getByRole("button", { name: "Giriş yap ve devam et", exact: true })
    .click();
  await register(page, `retry-${Date.now()}@example.test`);
  let dropped = false;
  await page.route("**/api/reports", async (route) => {
    if (!dropped && route.request().method() === "POST") {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Bildirimi gönder", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("taslağın korunur");
  await page
    .getByRole("button", { name: "Bildirimi gönder", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bildirimin kaydedildi.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Geri", exact: true }).click();
  await expect(page.locator(".report-card")).toHaveCount(1);
});
test("typed address works without GPS or map, survives restart and reaches the API without invented coordinates", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  let gpsCalls = 0;
  await page.exposeFunction("unexpectedGpsCall", () => {
    gpsCalls++;
  });
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = () => {
      void (
        window as unknown as { unexpectedGpsCall: () => Promise<void> }
      ).unexpectedGpsCall();
    };
  });
  await page.goto("/");
  await expect(page.locator(".greeting")).toHaveText("");
  expect(
    await page
      .locator(".greeting")
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(8);
  await page
    .getByRole("button", { name: "Yol hasarı bildir", exact: true })
    .click();
  await expect(page.getByText("Neyi etkiliyor?", { exact: false })).toHaveCount(
    0,
  );
  await page
    .getByLabel("Sorun açıklaması")
    .fill("Sokaktaki kaldırım taşları yerinden çıkmış.");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page
    .getByRole("button", { name: "Adresi elle yaz", exact: true })
    .click();
  await expect(page.getByTestId("location-map")).toHaveCount(0);
  await page.getByLabel("Açık adres", { exact: true }).fill("Kısa");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("en az 10 karakter");
  const address =
    "İstanbul, Kadıköy, Caferağa Mahallesi, Moda Caddesi No: 15 önü";
  await page.getByLabel("Açık adres", { exact: true }).fill(address);
  await page
    .getByRole("button", { name: "Haritadan seç", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adresi elle yaz", exact: true })
    .click();
  await expect(page.getByLabel("Açık adres", { exact: true })).toHaveValue(
    address,
  );
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page.reload();
  await page
    .getByText("Yarım kalan bir bildirimin var", { exact: true })
    .click();
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(page.getByLabel("Açık adres", { exact: true })).toHaveValue(
    address,
  );
  await page.screenshot({
    path: "artifacts/elle-adres.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(page.locator(".review-location")).toContainText(address);
  await page
    .getByRole("button", { name: "Giriş yap ve devam et", exact: true })
    .click();
  await register(page, `address-${Date.now()}@example.test`);
  const receipt = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/reports") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Bildirimi gönder", exact: true })
    .click();
  const report = await (await receipt).json();
  expect(report.location).toEqual({ source: "manual", address });
  await expect(page.locator(".detail-address")).toContainText(address);
  await expect(page.getByTestId("location-map")).toHaveCount(0);
  expect(gpsCalls).toBe(0);
});

test("denied GPS and blocked tiles still allow manual location selection; offline never submits", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) =>
      error?.({
        code: 1,
        message: "Permission denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Çöp birikmesi bildir", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Sorun açıklaması" })
    .fill("Parkın girişinde birkaç gündür çöp birikiyor.");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await page
    .getByRole("button", { name: "Mevcut konumumu kullan", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Konum izni verilmedi");
  await page
    .getByTestId("location-map")
    .click({ position: { x: 140, y: 120 } });
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await context.setOffline(true);
  await expect(
    page.getByText(
      "İnternet bağlantısı yok. Taslağını hazırlamaya devam edebilirsin.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Giriş yap ve devam et", exact: true }),
  ).toBeDisabled();
});
