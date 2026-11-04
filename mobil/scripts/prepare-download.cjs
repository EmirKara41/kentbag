const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const QR = require("qrcode");
const { version } = require("../package.json");
const { downloadUrl } = require("../production-service.json");
const root = path.resolve(__dirname, "../artifacts");
const filename = `KentYanimda-Android-${version}.apk`;
(async () => {
  const apk = await fs.readFile(path.join(root, filename));
  const sha256 = crypto.createHash("sha256").update(apk).digest("hex");
  const directory = path.join(root, "download");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), apk);
  const qr = await QR.toBuffer(downloadUrl, {
    width: 480,
    margin: 3,
    color: { dark: "#204c50", light: "#ffffff" },
  });
  await fs.writeFile(path.join(directory, "qr.png"), qr);
  await fs.writeFile(path.join(root, `android-qr-${version}-internet.png`), qr);
  await fs.writeFile(
    path.join(directory, "release.json"),
    JSON.stringify({ version, filename, sha256, downloadUrl }, null, 2),
  );
  await fs.writeFile(
    path.join(directory, "index.html"),
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>KentYanımda · Android ${version}</title><style>*{box-sizing:border-box}body{margin:0;background:#eff4f2;color:#244447;font:16px/1.65 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px}main{width:min(100%,470px);background:#fff;border:1px solid #dbe7e2;border-radius:24px;padding:32px}small{color:#69807d}h1{font-size:32px;letter-spacing:-1px;margin:8px 0}p{color:#5c7472}.label{font-size:11px;font-weight:700;letter-spacing:2px;color:#63877b}.version{display:inline-block;background:#edf5f0;border-radius:20px;padding:5px 13px;color:#416a5b;font-size:13px}a.download{display:block;background:#28675c;color:#fff;border-radius:13px;padding:16px;text-align:center;font-weight:700;text-decoration:none;margin:24px 0}.notice{background:#f5f7f4;border-radius:12px;padding:16px;font-size:14px}img{display:block;width:160px;height:160px;margin:16px auto}details{font-size:12px;color:#79908a;margin-top:20px;overflow-wrap:anywhere}footer{border-top:1px solid #e8eeeb;padding-top:18px;margin-top:24px;font-size:12px;color:#7a8c87}</style></head><body><main><span class="label">KENTBAĞ · VATANDAŞ UYGULAMASI</span><h1>KentYanımda</h1><span class="version">Android ${version} · İnternet demosu</span><p>Bir sorunu bildir, gelişmeleri takip et ve çözüm merkezinden gelen yanıtları gör.</p><a class="download" href="${filename}" download>Android uygulamasını indir</a><div class="notice"><strong>Mevcut uygulamanın üzerine güncelle.</strong><br>Uygulamayı silmen gerekmez. Bu sürüm Wi-Fi veya mobil veriyle çalışır; bilgisayarın açık olması gerekmez.</div><p><strong>İlk giriş:</strong> Eski yerel denemede açtığın hesap bu sunucuya taşınmadı. Uygulamada <strong>Hesap oluştur</strong> ile yeni vatandaş hesabını aç.</p><img src="qr.png" alt="Android indirme sayfasının QR kodu"><details><summary>Dosya doğrulaması · SHA-256</summary>${sha256}</details><footer>Ders projesi için test imzalı Android paketi · Google Play yayını değildir.<br>Gerçek belediye veya dağıtım kurumlarına resmi başvuru oluşturmaz.</footer></main></body></html>`,
  );
  console.log(JSON.stringify({ version, downloadUrl, filename, sha256 }));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
