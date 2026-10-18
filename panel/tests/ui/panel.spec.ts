import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Panel gezinme" })
    .getByRole("button", { name, exact: false })
    .click();
}
test("operator assigns, separates private notes from public updates, and preserves work after reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bugünün hizmet akışı", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/genel-bakis.png",
    animations: "disabled",
  });
  await nav(page, "Talepler");
  await page.getByLabel("Taleplerde ara").fill("Okul önündeki");
  await page.locator(".report-title-button").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Sorumlu birim").selectOption("public-works");
  await dialog.getByLabel("Saha ekibi").selectOption("t2");
  await dialog
    .getByRole("button", { name: "Yönlendirmeyi kaydet", exact: true })
    .click();
  await expect(dialog.locator(".detail-badges")).toContainText("Ekibe atandı");
  await dialog
    .getByLabel("Açıklama", { exact: true })
    .fill("Kurum içi koordinasyon ayrıntısı.");
  await dialog
    .getByRole("button", { name: "Açıklamayı kaydet", exact: true })
    .click();
  await dialog.getByLabel("Görünürlük").selectOption("citizen");
  await dialog
    .getByLabel("Açıklama", { exact: true })
    .fill("Ekip yönlendirmesi planlandı; inceleme sürüyor.");
  await dialog
    .getByRole("button", { name: "Açıklamayı kaydet", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Vatandaşta görünüm", exact: true })
    .click();
  await expect(dialog.locator(".citizen-preview")).not.toContainText(
    "Kurum içi koordinasyon ayrıntısı.",
  );
  await expect(dialog.locator(".citizen-preview")).toContainText(
    "Ekip yönlendirmesi planlandı",
  );
  await page.screenshot({
    path: "artifacts/talep-detayi.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Pencereyi kapat" }).click();
  await page.reload();
  await nav(page, "Talepler");
  await page.getByLabel("Taleplerde ara").fill("Okul önündeki");
  await expect(page.locator(".report-table tbody")).toContainText("FN-02");
  await page.locator(".report-title-button").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "İşlem geçmişi", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Kurum içi koordinasyon ayrıntısı.",
  );
  expect(errors).toEqual([]);
});
test("announcement editor links requests, previews public content and persists publication state", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Bölge duyuruları");
  await page.getByRole("button", { name: "İncele ve güncelle" }).click();
  await page
    .getByLabel("Vatandaşa açık açıklama")
    .fill("Hasarlı boru değiştirildi. Kontrollü su verme işlemi sürüyor.");
  await expect(page.locator(".phone-preview")).toContainText(
    "Kontrollü su verme",
  );
  await page.getByLabel("Tahmini bitiş").fill("Bugün 18.30");
  await page.getByRole("button", { name: "Örnek duyuruyu kaydet" }).click();
  await expect(page.locator(".announcement-card")).toContainText("Bugün 18.30");
  await expect(page.locator(".announcement-card")).toContainText(
    "2 ilişkili talep",
  );
  await page.reload();
  await nav(page, "Bölge duyuruları");
  await expect(page.locator(".announcement-card")).toContainText(
    "Kontrollü su verme",
  );
  await page.screenshot({
    path: "artifacts/bolge-duyurulari.png",
    animations: "disabled",
  });
});
test("manual-address reports stay off the map; map failure preserves the list", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await nav(page, "Harita");
  await expect(page.locator(".map-report-list")).toContainText(
    "Sağlık merkezine erişilebilir geçiş",
  );
  await expect(page.locator(".map-failure")).toBeVisible({ timeout: 22000 });
  await page
    .locator(".map-report-list button")
    .filter({ hasText: "Sağlık merkezine" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Adres elle girildi · Harita noktası yok",
  );
});
test("work completion does not close linked requests; export produces a marked CSV", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Çalışmalar ve sonuçlar");
  await page.getByRole("button", { name: "Çalışma kaydı oluştur" }).click();
  await page
    .getByLabel("Çalışma başlığı")
    .fill("Sağlık merkezi erişilebilir geçiş");
  await page.getByLabel("Mahalle / bölge").fill("Cumhuriyet");
  await page.getByLabel("Çalışma durumu").selectOption("completed");
  await page
    .getByLabel("Yapılan / planlanan işlem")
    .fill("Geçiş kotu ve kaldırım bağlantısı düzenlendi.");
  await page
    .getByLabel("Karşılanan ihtiyaç")
    .fill("Sağlık merkezine erişilebilir ulaşım");
  await page
    .getByRole("dialog")
    .getByRole("checkbox", {
      name: "Sağlık merkezine erişilebilir geçiş",
      exact: false,
    })
    .check();
  await page
    .getByRole("button", { name: "Çalışmayı kaydet", exact: true })
    .click();
  await expect(page.locator(".work-card")).toHaveCount(3);
  await page.screenshot({
    path: "artifacts/calisma-sonuclari.png",
    animations: "disabled",
  });
  await nav(page, "Talepler");
  await page.getByLabel("Taleplerde ara").fill("Sağlık merkezine");
  await expect(page.locator(".report-table tbody")).toContainText(
    "İnceleniyor",
  );
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "Görünümü dışa aktar" }).click();
  expect((await file).suggestedFilename()).toBe("KentBag-ornek-talepler.csv");
});
test("navigation and drawers work on narrow screens without page overflow", async ({
  page,
}) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const item of [
      "Genel bakış",
      "Talepler",
      "Bölge duyuruları",
      "Çalışmalar ve sonuçlar",
      "Birimler ve ekipler",
      "İşlem geçmişi",
    ]) {
      await nav(page, item);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
    await nav(page, "Talepler");
    await page.locator(".report-title-button").first().click();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Pencereyi kapat" }).click();
  }
});
