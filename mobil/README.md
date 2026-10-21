# KentYanımda · Yeni Android uygulaması

18 Ekim 2026. Önceki mobil uygulama bırakıldı. Bu klasör sıfırdan kurulan vatandaş uygulamasıdır; Pusula projesinde hiçbir değişiklik yapılmamıştır.

Kullanıcı APK'yı telefonuna kurup açar. Ana sayfa, bildirim formu, talepler, güncellemeler, hesap, profil, yardım ve gizlilik ekranları uygulamanın içindedir. Expo Go, Metro, tarayıcı kurulumu veya arayüzün açılması için açık bilgisayar gerekmez. Yerel pilotta veri işlemleri için bilgisayardaki API açık olmalıdır. Android 7 ve üzeri desteklenir.

## Bu pakette

- Bölgeye göre kişisel başlık; aktif olaylar, istekler ve tamamlanan çalışmalar için Mahallem.
- Tamamlanan taleplerim arşivi, gerçek kayıtlardan sayaçlar ve çözüm sonrası vatandaş geri dönüşü.
- Arıza / iyileştirme ayrımı; kaldırım, aydınlatma, erişilebilirlik ve ortak alan istekleri.
- Açıkça etiketlenmiş örnek mahalle yayını; cihazda destek/takip ve içerikleri gizleme. Ayrıntılar: [deneyim notları](URUN_DENEYIMI.md).
- Yeni, telefon odaklı arayüz; beş bölümlü alt menü ve Android geri tuşu.
- Üç adımda elektrik/su/çöp/yol/buzlanma bildirimi.
- Yerel kamera/galeri, en fazla üç fotoğraf, JPEG küçültme ve görüntüleme.
- İstek anında konum izni, GPS ve haritadan manuel seçim; arka planda konum takibi yok.
- Harita veya GPS kullanmadan açık adresi tamamen elle yazma, taslakta koruma ve gönderme.
- Cihazda otomatik taslak kaydı, geri dönme ve devam etme.
- Uygulama içinde giriş/kayıt; sunucu hazır olduğunda gerçek hesap, talep numarası, durum geçmişi ve notlar.
- Bağlantı yokken açıklayıcı durum; sunucu onayı olmadan gönderildi denmez.
- Android Keystore ile şifrelenen oturum; sırlar mobil pakete girmez.

1.2.1 LAN paketi gerçek yerel API'ye bağlıdır. Hesap oluşturma, fotoğraf/talep gönderme ve belediye panelinden durum/açıklama/çözüm alma çalışır. Kurulum, ağ ve Gemini ayrıntıları: [Oltu yerel deneme](../YEREL_DENEME.md). İnternet üzerindeki üretim API'si henüz dağıtılmadı.

## Android paketi

```powershell
npm ci
npm run android:apk
npm run phone
```

Çıktı: `artifacts/KentYanimda-Android-1.2.1.apk`. `phone` yalnız indirme sayfasını ve QR kodunu sunar. İndirme sırasında telefon ve bilgisayar aynı ağda olmalıdır. Arayüz gömülüdür; LAN API işlemleri için bilgisayarın açık olması gerekir.

Derleme bu bilgisayarda `%USERPROFILE%/.cache/kentyanimda-android/tools.json` ile kayıtlı JDK 21 ve Android SDK'yı kullanır. Yeni bilgisayarda Node.js 22+, JDK 21 ve SDK 36 hazırlayıp bu dosyadaki `javaHome` / `sdkRoot` yollarını ayarlayın. Sistem PATH ayarlarını değiştirmez. Anahtar önbellekte `signing/kent-mobile-preview.keystore` altında saklanır; kaynak veya APK içine konmaz. Aynı anahtar sonraki test güncellemeleri için korunmalıdır. APK iç deneme anahtarıyla imzalıdır; mağaza yayını değildir.

`verify-apk.ps1`, APK içindeki tüm arayüz dosyalarını güncel `dist` ile SHA-256 karşılaştırır, dış sunucudan arayüz yükleme ayarının bulunmadığını, paket kimliğini, imzayı ve manifesti kontrol eder. Kaynak Android projesi sürüm kontrolünde tutulur; `cap sync` arayüz ve eklentileri günceller.

## Canlı hizmeti bağlama

`sunucu/README.md` içindeki Vercel/Neon/özel Blob kurulumunu tamamlayın. APK derleme ortamı (veya PowerShell oturumunda `$env:VITE_PRODUCTION_API_URL`):

```dotenv
VITE_PRODUCTION_API_URL=https://SABIT-API-ADRESI.vercel.app
```

APK'yı yeniden derleyin. Mobil uygulama sır veya veritabanı bağlantısı içermez. Better Auth imzalı bearer oturumunu kullanır. Sunucu `https://localhost` Android WebView kaynağını kabul eder; web önizleme adresleri `WEB_ORIGINS` içinde ayrıca belirtilmelidir. Üretimde HTTP API adresi kabul edilmez.

Yerel taslaklar misafir ve hesap başına ayrıdır. Misafirken hazırlanan taslakla giriş yapıp gönderme akışı korunur. Dosyalar yalnız sunucu makbuzu alındıktan sonra taslak listesinden çıkarılır. Aynı istek kimliğiyle tekrar gönderim ikinci talep oluşturmaz.

## Geliştirme ve doğrulama

```powershell
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run build
```

UI testleri izole bir API, gerçek Better Auth oturum akışı, PGlite PostgreSQL ve test Blob deposu ile çalışır. Kayıt, fotoğraf yükleme, GPS, talep makbuzu, not, yeniden açılış, taslaklar, kaybolan makbuzda tekrar deneme, izin reddi ve çevrimdışı davranışı sınar. Testler gerçek Vercel/Neon bağlantısı veya fiziksel Android kamera testi sayılmaz.

Yeni senaryolar mahalle desteğinin kalıcılığı ve kişisel kayıtlardan ayrılması, iyileştirme/etki bilgisinin API'ye iletilmesi, tamamlanan arşivi, çözüm geri dönüşü ve yakın olaydan taslağa dönüşü sınar. Üretim önizlemesi çalışırken `node scripts/review-ui.cjs` ile 320/390/412 px incelemesi ve ekran görüntüleri üretilebilir.

Teknoloji: React + TypeScript + Vite + Capacitor 8. Resmî kaynaklar: [Capacitor Android](https://capacitorjs.com/docs/android), [Camera](https://capacitorjs.com/docs/apis/camera), [Geolocation](https://capacitorjs.com/docs/apis/geolocation), [Better Auth bearer](https://better-auth.com/docs/plugins/bearer).
