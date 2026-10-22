const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  QR = require("qrcode");
const version = require("../package.json").version;
const root = path.resolve(__dirname, "../artifacts"),
  apkName = `KentYanimda-Android-${version}.apk`,
  apk = path.join(root, apkName);
const ips = Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
  (list || [])
    .filter((x) => x.family === "IPv4" && !x.internal)
    .map((x) => ({ name, ip: x.address })),
);
const ip =
    ips.find((x) => /wi-fi|wlan/i.test(x.name))?.ip ||
    ips[0]?.ip ||
    "127.0.0.1",
  url = `http://${ip}:8181`;
(async () => {
  fs.mkdirSync(root, { recursive: true });
  const qr = await QR.toBuffer(url, {
    width: 400,
    margin: 2,
    color: { dark: "#1d4b8f", light: "#ffffff" },
  });
  fs.writeFileSync(path.join(root, "android-qr.png"), qr);
  const qrName = `android-qr-${version}-${ip.replaceAll(".", "-")}.png`;
  fs.writeFileSync(path.join(root, qrName), qr);
  http
    .createServer((req, res) => {
      const route = new URL(req.url, "http://localhost").pathname;
      if (route === "/qr.png") {
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }).end(qr);
        return;
      }
      if (route === "/KentYanimda.apk") {
        if (!fs.existsSync(apk)) {
          res.writeHead(503).end("APK hazirlaniyor");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/vnd.android.package-archive",
          "Content-Length": fs.statSync(apk).size,
          "Content-Disposition":
            `attachment; filename="${apkName}"`,
          "Cache-Control": "no-store",
        });
        fs.createReadStream(apk).pipe(res);
        return;
      }
      if (route !== "/") {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .end(
          `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KentYanımda · Android</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f1f5fb;font:15px/1.7 system-ui;color:#223955;padding:20px;box-sizing:border-box}main{max-width:430px;text-align:center;border:1px solid #dce6f2;border-radius:24px;background:white;padding:32px}h1{margin:0;font-size:29px;letter-spacing:-1px}img{width:220px}a{display:block;background:#216ce5;border-radius:12px;padding:15px;color:white;text-decoration:none;font-weight:650}p{color:#7c8da3}small{font-size:12px;color:#90a0b5}.note{background:#f0f5fd;padding:14px;border-radius:12px;text-align:left;font-size:12px}</style><main><h1>KentYanımda</h1><p>Yeni Android uygulaması · ${version}</p><img src="/qr.png" alt="Android uygulamasını indirme bağlantısı"><a href="/KentYanimda.apk">Android uygulamasını indir</a><p>APK'yı indir, telefonuna kur ve aç.<br>Yardımcı uygulama gerekmez.</p><p class="note">Bu paket iç deneme sürümüdür. Kamera, konum, menüler ve taslak hazırlama kullanılabilir. Hesap açma ve talep gönderimi Oltu yerel sunucusuna bağlıdır. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.</p><small>İndirirken telefon ve bilgisayar aynı ağda olmalı. Uygulama kendi menüleriyle açılır; talep gönderme ve güncellemeleri almak için bu bilgisayardaki sunucu açık olmalıdır. Test imzalı APK; mağaza yayını değildir.</small></main></html>`,
        );
    })
    .listen(8181, "0.0.0.0", () =>
      console.log(
        `Android download: ${url}\nQR: ${path.join(root, qrName)}`,
      ),
    );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
