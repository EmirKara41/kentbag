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
Veritabanı değişikliği varsa önce `npm run migrate` (DATABASE_URL yeni veritabanı).

APK: `powershell -File scripts/build-android.ps1 -ApiUrl https://kentbag2-api.vercel.app`
(imza anahtarı `%USERPROFILE%\.cache\kentyanimda-android\signing`).

Web: `cd web && VITE_API_URL=https://kentbag2-api.vercel.app npm run build && node scripts/prepare-cloud.mjs && npx vercel@65.11.0 deploy --prebuilt --prod`

Telefon bildirimleri için Firebase gerekir: `google-services.json` iki uygulamanın
`android/app/` klasörüne, servis hesabı JSON'u base64 olarak API'ye
`FIREBASE_SERVICE_ACCOUNT`; ardından APK'ları `-Push on` ile yeniden derle.

Eski sistem `yedek-2026-11-12` etiketinde ve `C:\Users\emirk\KentBag-Yedek-2026-11-12` klasöründe.
