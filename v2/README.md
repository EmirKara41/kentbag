# KentBağ v2

Vatandaşın bildirdiği sorunu yapay zekâ ajanı doğru kuruma ve en erken
varabilecek ekibe iletir; vatandaş süreci kargo takibi gibi izler.

## Canlı adresler

| Ne | Adres |
|---|---|
| Belediye merkezi ve kurum paneli | https://kentbag2-web.vercel.app |
| Android uygulamaları (vatandaş + ekip) | https://kentbag2-web.vercel.app/indir/ |
| API sağlık kontrolü | https://kentbag2-api.vercel.app/api/health |

Giriş ekranlarındaki **Demo olarak gir** düğmeleri şifresiz demo girişi sağlar
(`DEMO_LOGIN=on`). Sunumdan sonra kapatmak için API projesinde `DEMO_LOGIN`
değişkenini silip yeniden yayınla.

## Kim neyi kullanır

| Rol | Uygulama | Klasör |
|---|---|---|
| Vatandaş | Android "KentBağ" (`com.kentbag.vatandas`) | `citizen/` |
| Saha ekibi | Android "KentBağ Ekip" (`com.kentbag.ekip`) | `crew/` |
| Belediye merkezi | Web paneli | `web/src/center/` |
| Kurum (elektrik, su, temizlik, fen, park) | Web paneli | `web/src/institution/` |
| Sunucu (API, ajan, bildirimler) | Vercel | `api/` |

Bir hesap tek bir personel rolüne sahiptir (merkez, kurum veya ekip).

## Bir talebin yolu

Alındı → Kuruma iletildi → Ekibe atandı → Ekip yolda → Ekip sahada → Çözüldü

- Ajan (`api/src/agent.ts`) kategoriye göre kurumu seçer, Gemini anahtarı varsa
  aciliyet önerir; ekibi en erken varış süresine göre seçer (`shared/src/assign.ts`).
- Merkez veya kurum ajanı kapatabilir; o zaman aynı işler panelden elle yapılır.
- Ekip "Bitti" dediği anda talep kapanır ve vatandaşa bildirim gider.
- Vatandaş "Sorun devam ediyor" derse talep yeniden açılır, ajan tekrar atar.

## Faz 2 özellikleri

- **İyileştirme önerileri:** Vatandaş "İyileştirme öner" der (aydınlatma, kaldırım, erişilebilirlik, park). Ajan kuruma yönlendirir, ekibe atamaz. Kurum *Planlandı*, *Tamamlandı* ya da gerekçeli *Uygulanmayacak* der.
- **Ortak sorunlar:** Bildirim ekranı 1,5 km içindeki aynı sorunları gösterir. "Ben de etkileniyorum" diyen vatandaş talebi takip eder ve bildirim alır; bildirenin metni, fotoğrafı ve tam konumu gizli kalır. Panelde **Yakında aynı sorun** bölümünden talepler birleştirilir. Birleşen talep ana talebin durumunu gösterir ve onunla kapanır. Sorun sürerse vatandaş talebini ayırıp yeniden açabilir.
- **Duyurular:** Panelde *Duyurular*. Merkez belediye adına, kurum kendi adına yayınlar. Duyuru vatandaşın ana ekranında görünür.
- **Personel:** Panelde *Personel*. Merkez her rolden hesap açar ve kapatır; kurum yalnız kendi ekip hesaplarını yönetir. Var olan bir e-postaya personel rolü verilmez. Vatandaş Ayarlar ekranından **Saha ekibine başvur**ur; kurum onaylayınca aynı hesapla KentBağ Ekip uygulamasına girer.
- **Şifremi unuttum:** Üç girişte de var. Bağlantı e-postayla gelir ve web'deki `/sifre` sayfasını açar. E-posta için API'de `RESEND_API_KEY` gerekir (gönderen varsayılan olarak eski sistemdeki `bildirim@lollore.com`; `MAIL_FROM` ile değişir). Anahtar yoksa istek kabul edilir ama e-posta gitmez.
- **Raporlar:** Panelde *Raporlar*: talep sayıları, ortalama varış ve çözüm süresi, yeniden açılma oranı, kurum ve kategori kırılımı, **CSV indir**.

Veritabanı şeması API açılırken kendiliğinden güncellenir (`api/src/schema.ts`, yalnız ekleme). Faz 1'e dönmek için `faz1-tamam` etiketi ve `C:\Users\emirk\KentBag-Yedek-Faz1-2026-11-18\GERI-DON.md`.

## Klasörler

```
shared/   iş kuralları (kategoriler, durumlar, ETA, ekip seçimi) + ortak arayüz parçaları
api/      Express sunucusu: talepler, ajan, ekip/kurum/merkez uçları, bildirim, demo girişi
web/      merkez ve kurum paneli (React)
citizen/  vatandaş Android uygulaması (React + Capacitor)
crew/     ekip Android uygulaması (React + Capacitor)
scripts/  APK derleme ve Android kurulum betikleri
```

## Geliştirme

```
npm install                     # v2/ içinde, bir kez
npm -w api run dev              # yerel API: http://127.0.0.1:3100, demo hesaplarla
npm -w web run dev              # panel: http://127.0.0.1:5173
npm -w citizen run dev          # vatandaş uygulaması tarayıcıda: 5174
npm -w crew run dev             # ekip uygulaması tarayıcıda: 5175
npm test                        # tüm birim ve API testleri
npm -w web run test:ui          # panel tarayıcı testleri (Edge)
```

## Yayınlama

API: `cd api && npm run build:cloud && npm run stage-deploy && cd .deploy && npx vercel@65.11.0 deploy --prod`
Şema değişiklikleri API açılırken uygulanır; ayrıca migrate çalıştırmak gerekmez.

APK: `powershell -File scripts/build-android.ps1 -ApiUrl https://kentbag2-api.vercel.app`
(imza anahtarı `%USERPROFILE%\.cache\kentyanimda-android\signing`).

Web: `cd web && VITE_API_URL=https://kentbag2-api.vercel.app npm run build && node scripts/prepare-cloud.mjs && npx vercel@65.11.0 deploy --prebuilt --prod`

Telefon bildirimleri için Firebase gerekir: `google-services.json` iki uygulamanın
`android/app/` klasörüne, servis hesabı JSON'u base64 olarak API'ye
`FIREBASE_SERVICE_ACCOUNT`; ardından APK'ları `-Push on` ile yeniden derle.

Eski sistem `yedek-2026-11-12` etiketinde ve `C:\Users\emirk\KentBag-Yedek-2026-11-12` klasöründe.
