const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
async function review() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 412]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      async function fits() {
        const sizes = await page.locator('main').evaluate(main => ({ width: main.clientWidth, content: main.scrollWidth }));
        assert.ok(sizes.content <= sizes.width + 1, `${width}px: content overflows ${JSON.stringify(sizes)}`);
      }
      await page.goto('http://localhost:4173/');
      await page.getByRole('button', { name: 'Bölgeni değiştir', exact: true }).waitFor();
      assert.equal(await page.locator('.greeting').innerText(), '');
      await fits();
      if (width === 390) {
        await page.screenshot({ path: 'artifacts/ana-sayfa.png', animations: 'disabled' });
        await page.locator('.completed-collection').scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'artifacts/ana-sayfa-kayitlar.png', animations: 'disabled' });
      }
      await page.getByRole('navigation').getByRole('button', { name: 'Sorun bildir', exact: true }).click();
      assert.equal(await page.locator('.impact-options').count(), 0);
      await page.getByRole('radio', { name: 'Yol hasarı', exact: true }).click();
      await page.getByLabel('Sorun açıklaması').fill('Sokaktaki yol yüzeyi onarım gerektiriyor.');
      await page.getByRole('button', { name: 'Devam et', exact: true }).click();
      await page.getByRole('button', { name: 'Adresi elle yaz', exact: true }).click();
      await page.getByLabel('Açık adres', { exact: true }).fill('İstanbul, Kadıköy, Moda Caddesi No: 15 önü');
      await fits();
      if (width === 390) await page.screenshot({ path: 'artifacts/elle-adres.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Geri', exact: true }).click();
      await page.getByRole('button', { name: 'Geri', exact: true }).click();
      await page.getByRole('button', { name: 'Taslağı kaydet ve çık', exact: true }).click();
      await page.getByRole('navigation').getByRole('button', { name: 'Mahallem', exact: true }).click();
      await fits();
      await page.getByRole('button', { name: 'İstekler', exact: true }).click();
      await fits();
      if (width === 390) await page.screenshot({ path: 'artifacts/mahallem.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Tamamlanan', exact: true }).click();
      await page.locator('.community-card').click();
      await fits();
      await page.getByRole('heading', { name: 'Öncesi ve sonrası', exact: true }).scrollIntoViewIfNeeded();
      if (width === 390) await page.screenshot({ path: 'artifacts/calisma-sonucu.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Geri', exact: true }).click();
      await page.getByRole('navigation').getByRole('button', { name: 'Kayıtlarım', exact: true }).click();
      await fits();
      await page.getByRole('navigation').getByRole('button', { name: 'Ana sayfa', exact: true }).click();
      await page.locator('.completed-collection').click();
      await page.getByRole('heading', { name: 'Tamamlanan taleplerim', exact: true }).waitFor();
      await fits();
      await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
      await page.getByText('Hesap hizmeti henüz kullanıma açılmadı.', { exact: false }).waitFor();
      assert.equal(await page.locator('form button[type=submit]').isDisabled(), true);
      assert.deepEqual(errors, []);
      process.stdout.write(`${width}px: home, neighborhood, outcome, archive, unconfigured auth passed; no overflow or runtime errors\n`);
      await context.close();
    }
  } finally { await browser.close(); }
}
review().catch(error => { console.error(error); process.exitCode = 1; });
