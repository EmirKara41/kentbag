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

## Yapay zekâ: ne yapıyor, nasıl ölçüldü

**İki görev, ikisi de yalnızca öneri niteliğinde (hiçbir talebi engellemez):**

1. **Fotoğraf–bildirim uyumu** (görüntü sınıflandırma, 3 sınıf: `ok` / `doubtful` / `unrelated`). Vatandaş "yol hasarı" deyip yemek fotoğrafı gönderirse talep otomatik ekip atamasında bekletilir; personel yine elle atayabilir.
2. **Önce/sonra teyidi**: ekip işi kapatınca kapanış fotoğrafı vatandaşın fotoğrafıyla karşılaştırılır (`confirmed` / `unclear` / `mismatch`).

Akış: fotoğraf + kategori + açıklama → Gemini (`gemini-3.5-flash-lite`, AI SDK, şemalı JSON çıktı) → karar + kısa gerekçe → panelde rozet. Kod: [`api/src/vision.ts`](api/src/vision.ts), [`api/src/agent.ts`](api/src/agent.ts).

**Ölçüm** ([`api/eval`](api/eval)): iki set, toplam 30 etiketli durum. Set 1: 8 gerçek sorun, 4 alakasız fotoğraf, 3 zor durum (karanlık, bulanık, açıklamaya gizlenmiş talimat). Set 2: farklı kategoriler (buzlanma, su, çöp) ve farklı koşullar: 90° döndürülmüş, ters çekilmiş, 64 piksele küçültülmüş, aşırı pozlanmış fotoğraf, yazım hatalı ve İngilizce açıklama, yanlış kategori, görselin üstüne yazılmış talimat. Fotoğraflar Wikimedia Commons'tan serbest lisanslı (`api/eval/photos/sources.json`); `hard-*` dosyaları bunlardan türetildi.

| Ölçü | Set 1 | Set 2 | Toplam (30) |
|---|---|---|---|
| Tam doğruluk (3 sınıf) | %93 (14/15) | %87 (13/15) | **%90 (27/30)** |
| "Alakasız" kesinlik / duyarlılık | %100 / %100 | %100 / %100 | **%100 / %100** (9/9, yanlış alarm 0) |
| Gerçek sorunların geçme oranı | 8/8 | 9/9 | **17/17** |
| Yanıt süresi (medyan) | 1,9 sn | 2,4 sn | ~2,3 sn · ort. 3,0 sn · en çok 6,8 sn |

Karışıklık matrisi (toplam; satır beklenen, sütun model): ok → 17/0/0 · doubtful → 3/1/0 · unrelated → 0/0/9.
Karşılaştırma noktası: YZ kontrolü yokken alakasız fotoğrafların %0'ı yakalanır.

Başarısız örnekler (3/30, hepsi aynı türden): %12 parlaklıkta gece fotoğrafı, 64 piksele küçültülmüş buz fotoğrafı ve aşırı pozlanmış su borusu fotoğrafı `doubtful` beklenirken `ok` dendi. Model üçünde de sorunu gerçekten seçebildi; yani görüntü kalitesi düşük olsa da içerik görünürse model "uygun" diyor. Hata "fazla iyimser" yönde, gerçek bildirimleri engellemiyor; bu yüzden karar yalnızca öneri. İyileştirme: modele gitmeden önce parlaklık ve çözünürlüğü kuralla ölçmek. Ayrıntı: [`api/eval/RESULTS.md`](api/eval/RESULTS.md), [`api/eval/RESULTS2.md`](api/eval/RESULTS2.md).

Yeniden çalıştırmak: `GEMINI_API_KEY=... npm run eval:photos -w @kentbag/api` (set 2 için sonuna ` -- 2`)

**Sınırlılıklar:** 30 örnek küçük bir set; sonuçlar yön gösterir, genelleme iddiası taşımaz. Model yüz/plaka tanımlamaması için yönlendirildi, fotoğraflar yalnızca bu kontrol için gönderilir. Ücretsiz katman dakikalık kotaya takılabilir; o durumda kontrol atlanır, talep normal akışta ilerler.

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
