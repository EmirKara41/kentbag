# Yeni Android uygulaması · Doğrulama

18 Ekim 2026 · 1.1.1 (Android versionCode 12).

| Kontrol | Sonuç |
| --- | --- |
| Mobil TypeScript | Geçti |
| ESLint / React hook kontrolleri | Geçti |
| Alan doğrulama, tür/kategori ve tamamlanan arşivi | 5/5 test geçti |
| Uçtan uca UI → API → PostgreSQL → arayüz | 9/9 senaryo geçti |
| Sunucu TypeScript | Geçti |
| Sunucu erişim, imzalı Android oturumu ve talep yaşam döngüsü | 12/12 test geçti |
| Üretim önizlemesi: 320 / 390 / 412 px | Ana sayfa, mahalle, çalışma sonucu, arşiv ve kapalı hesap hizmeti geçti; taşma/JS hatası yok |
| Üretim web paketi | Oluşturuldu; arayüz ve harita yerel dosyalar |
| Android release APK | Başarıyla derlendi |
| APK imzası | v2 imzası geçerli; bir imzalayan |
| APK içindeki arayüz | Her dosya güncel dist ile SHA-256 eşleşiyor |
| Dışarıdan arayüz yükleme | server.url yok; tüm ekranlar APK'da |
| Manifest | Android API 24+, hedef SDK 36; yedekleme kapalı |
| Mobil üretim bağımlılıkları | npm audit --omit=dev: 0 açık |
| Canlı Vercel / Neon / Blob | Henüz dağıtılmadı |
| Fiziksel Android kurulum / kamera / GPS | Bağlı cihaz yok; henüz doğrulanmadı |

Senaryolar:

1. Misafir olarak sorun hazırlama, fotoğraf seçip JPEG'e çevirme, kontrollü GPS, uygulama içinde hesap açma, gerçek HTTP yükleme, PostgreSQL kaydı, makbuz, özel fotoğraf görüntüleme, not ekleme ve sayfa yeniden açıldığında oturumu bulma.
2. Taslağı kaydetme, yeniden açılışta devam etme ve alt menüyle uygulama içi gezinme.
3. Sunucu kayıt yaptıktan sonra makbuz yanıtını ağda düşürme, taslağın korunması ve tekrar gönderimde tek talep oluşması.
4. Konum izni reddi ve iki harita kaynağı kapalıyken manuel nokta seçimi; internet kesildiğinde gönderimin engellenmesi.
5. Bölge seçimi, örnek mahalle isteğini destekleme, otomatik takip, yeniden açılışta tek destek ve takip filtresi; örnekleri gizleme, kişisel kayıtlara karışmama.
6. Erişilebilirlik iyileştirme isteğinin giriş/kayıt sonrası gerçek HTTP isteğiyle PostgreSQL'e kaydedilmesi.
7. İzole testte kurum çözümü oluşturma, kişisel tamamlanan arşivinde kalıcılık, geri çekilenlerin sayılmaması, sorun devam ediyor geri dönüşünün kaydedilmesi ve devam edenler listesine yansıması.
9. Elle adresi GPS ve harita noktası olmadan hazırlama; kısa adresin reddi; yöntem değiştirince ve yeniden açınca adresin korunması; gerçek API kaydı ve detayda harita gösterilmemesi. Karşılama alanının boş/dar ve etki seçiminin formdan çıkarılmış olması.

8. Yakındaki bilinen örnek olayı bildirim içinden açıp destekleme; geri dönünce konum, adım ve taslak açıklamasının korunması.

Sunucu testleri ayrıca talep türü/kategori uyuşmazlığını, çözüm öncesi geri dönüşün reddini, başka kullanıcı erişimini, resmi durumu değiştirme girişiminin etkisiz kalmasını ve geri dönüş geçmişinin korunmasını doğrular. UI test senaryoları arasında yalnız izole bellekteki giriş hız sınırı sıfırlanır; üretim hız sınırları açık kalır. Test durum değiştirme uçları üretim uygulamasında yoktur.

API ve UI testleri için gerçek Better Auth oturum akışı (test belleği adaptörü), PGlite PostgreSQL ve test fotoğraf deposu kullanıldı. Bu servisler dağıtılan APK'ya dahil edilmedi. Günlük kullanımda hesap ve talepler için gerçek HTTPS sunucusu gerekir. Paket bu bağlantı tamamlanana kadar hesap hizmetini açık göstermiyor.

APK izinleri: internet, ağ durumu, yaklaşık/hassas konum ve Android'in dışa kapalı dinleyici izni. Mikrofon, arka plan konumu ve geniş depolama erişimi yoktur. Kamera/galeri Android'in ilgili arayüzüyle açılır.

APK: `artifacts/KentYanimda-Android-1.1.1.apk` · 7.239.174 bayt. SHA-256: `74DB336000D0D2DB237C98B765CB07F6D2C64A205C756713F8F07FBB2E2647BA`.

İndirme hizmetindeki APK ile dosyanın SHA-256 değeri eşleşti. Son başarılı paketleme/doğrulama günlüğü `artifacts/android-1.1.1-build-final.log` altındadır. Windows doğrulama betiği dosya hash'i için doğrudan .NET kullanır; `Get-FileHash` modülünün yüklü olmasına bağlı değildir.

Ekran görüntüleri: `artifacts/ana-sayfa.png`, `ana-sayfa-kayitlar.png`, `mahallem.png`, `calisma-sonucu.png`, `elle-adres.png`, `tamamlanan-taleplerim.png` ve `talep-detay.png`. Kişisel kayıt görüntüleri izole test hesabından alınmıştır; gerçek belediye kayıtları değildir. Ortak mahalle içeriği etiketlenmiş örneklerdir; önce/sonra görselleri temsili çizimlerdir.
