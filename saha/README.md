# KentBağ Saha · Android 0.1.3

11 Kasım 2026: Giriş ekranında **Şifremi unuttum** bağlantısı var. [Şifre kurtarma sayfasına](https://kentbag-panel-emir-kara-s-projects.vercel.app/sifre-sifirla) hesabın e-postası girilir; varsa doğrudan o adrese Resend üzerinden 30 dakika geçerli ve tek kullanımlık bağlantı gönderilir. Kurum demo posta yönlendirmesi bu e-postaya uygulanmaz. Yeni şifre belirlenince eski oturumlar kapatılır; vatandaş kayıtları ve saha kurum/ekip yetkisi değişmez. Şifreler geri okunmaz. Testler e-posta göndermeden sahte taşıyıcıyla yapılır. Gerçek gelen kutusu teslimi kullanıcı tarafından kontrol edilmelidir.

Elektrik, su, yol, temizlik ve park ekipleri aynı uygulamayı kullanır. Giriş ekranındaki **Hesabım yok · Hesap oluştur** ile ad, e-posta ve en az 12 karakter şifre girilir. Ardından kurum ve ekip seçilip başvuru gönderilir. Mevcut vatandaş hesabıyla da giriş yapılarak aynı başvuru yapılabilir. Hesap açmak görev yetkisi vermez; merkez **Personel hesapları → Saha hesabı başvuruları** bölümünden başvuruyu onaylar veya gerekçeyle reddeder. Onaylandığında açık saha uygulaması görev ekranına geçer; yeniden giriş gerekmez. Bekleyen başvuru uygulama yeniden açıldığında korunur.

Merkez doğrudan `Saha personeli` rolüyle hesap oluşturmayı da sürdürebilir. Kapatılmış personel erişimi yeni başvuruyla tekrar açılamaz. Başvuru onayı yalnız saha rolü verir; merkez veya kurum sorumlusu yetkisi vermez. Sunucuda `010_crew_enrollment.sql` göçü gerekir. `sunucu/tests/enrollment.test.ts` onay, ret, yeniden başvuru, eski onay isteği ve erişim kapatma sınırlarını denetler.

- [Android APK ve QR](https://kentbag-panel-emir-kara-s-projects.vercel.app/saha/indir/)
- [Tarayıcı önizlemesi](https://kentbag-panel-emir-kara-s-projects.vercel.app/saha/)
- Deneme hesapları yalnız yerel `sunucu/.local/KENTBAG_DEMO_HESAPLARI.md` dosyasındadır; herkese açık dosyalara gömülmez.

## Çalışma akışı

1. Merkez talebi ilgili kurumun kuyruğuna iletir.
2. Kurum incelemeye alır, kendi ekibine görev atar.
3. Saha hesabı görevi kabul eder, sahaya çıkınca çalışmaya başladığını kaydeder. İş zaten bittiyse sonucu doğrudan gönderebilir.
4. Ekip en az 15 karakter açıklamayla sonucu kurum kontrolüne gönderir. Elektrik ve su kesintilerinde fotoğraf isteğe bağlıdır (kesinti fotoğrafla kanıtlanamaz); diğer işlerde 1–3 sonuç fotoğrafı gerekir.
5. Kurum sonucu düzeltme için ekibe iade eder veya belediye merkezine iletir. Düzeltme istenen görev listede **Düzeltme istendi** etiketiyle en üstte görünür.
6. Merkez kuruma iade eder veya açıklamayı ve fotoğrafları talep sahibi ile takip eden hesaplarla paylaşır. Ancak bu son adım talebi çözüldü durumuna geçirir.

Ekip görevi yapamıyorsa (adres bulunamadı, malzeme yok, başka kurumun işi) **Kuruma iade et** ile en az 15 karakter gerekçe yazar. Görev "Ekip görevi iade etti" durumuna geçer; kurum gerekçeyi görür, hazır görevi iptal edip başka ekibe veya yeniden hazırlar. İade vatandaşa açılmaz. Sunucuda `011_crew_decline.sql` göçü gerekir.

Kurum ve merkez kontrol notları vatandaşlara açılmaz. Vatandaşın ilk fotoğrafları ortak listeye açılmaz. Yalnız merkez tarafından onaylanan sonuç fotoğrafları talep sahibi ve mevcut takipçilere sunulur. Bildirimler uygulama içinde yenilemeyle gelir; işletim sistemi push bildirimi eklenmemiştir.

Menüler APK içine gömülüdür; Expo Go, bilgisayar veya ortak Wi-Fi gerekmez. API için internet gerekir. Android oturum anahtarı Keystore ile şifrelenir. Metin ve fotoğraf taslakları kullanıcı/görev bazında cihazda saklanır; başarısız gönderimde silinmez. İlk sürümde çevrimdışı görev listesi ve arka planda otomatik gönderim yoktur.

## Geliştirme ve doğrulama

`npm ci`, `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run android:apk`.

`scripts/prepare-download.cjs` indirme sayfasını oluşturur (QR bağımlılığı vatandaş uygulamasının mevcut kurulumu üzerinden kullanılır). Panelin `prepare-cloud.mjs` betiği önizleme ve indirme dosyalarını yayına paketler. Sunucuda `009_field_work.sql` gerekir. `sunucu/tests/field.test.ts` rol ayrımı, erken yayın engeli, iki yönlü iade, sahip/takipçi fotoğrafları, yinelenen istekler ve kalıcılığı sınar. `sunucu/scripts/verify-field-cloud.mjs` yalnız açıkça DEMO olarak işaretlenmiş sentetik kayıt üzerinde bulut akışını doğrular.

APK imzası ve gömülü arayüz doğrulanır. Gerçek telefondaki kamera/galeri izinleri ayrıca cihaz üzerinde denenmelidir.
