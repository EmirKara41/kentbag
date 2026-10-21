# KentBağ

Vatandaş, belediye merkezi ve saha ekiplerini aynı talep sürecinde buluşturan uygulama.

Proje adı KentBağ'dır. Mevcut vatandaş uygulamasının görünen adı KentYanımda, Android paket kimliği `com.kentyanimda.vatandas` olarak korunur; kurulu uygulamalar sonraki paketlerle güncellenebilir.

- `mobil/`: Android vatandaş uygulaması. Bölge ana sayfası, aktif olaylar, iyileştirme istekleri, tamamlanan kişisel talepler, kamera/galeri, GPS/harita ve hesap ekranları APK'nın içindedir. [Yeni deneyim ve bağlantı sınırları](mobil/URUN_DENEYIMI.md).
- `sunucu/`: Vercel üzerinde çalışacak API; Better Auth ile giriş, PostgreSQL kayıtları ve özel Vercel Blob fotoğrafları.
- `panel/`: Belediye merkez biriminin web paneli. Oltu yerel pilotunda gerçek vatandaş taleplerine bağlıdır; örnek çalışma alanı ayrıca açılabilir. [Panel kılavuzu](panel/README.md).

Oltu pilotunda vatandaş → yerel API → belediye paneli ve panel → vatandaş durum/açıklama/çözüm akışı bağlıdır. Gerçek hesaplar, talepler ve fotoğraflar bilgisayarda kalıcı saklanır. Aciliyet önerisi Gemini anahtarı yokken gerekçeli kurallarla, anahtar eklenince Gemini ile üretilir; yetkili kararı ayrı tutulur. İnternetteki Vercel/Neon/Blob üretim kaynakları henüz dağıtılmadı. Saha uygulaması üçüncü bloktur.

Android menüleri APK içine gömülüdür; yardımcı uygulama gerekmez. Bu yerel pilotta kayıt göndermek ve güncelleme almak için telefon aynı ağda olmalı ve bilgisayardaki API açık kalmalıdır. [Yerel deneme ve yeniden başlatma](YEREL_DENEME.md). APK hazırlama/indirme: [mobil kılavuzu](mobil/README.md). [Vercel kurulumu](sunucu/README.md). Kabul edilen ürün kapsamı: [kapsam](URUN_KAPSAMI.md).

Önceki mobil çalışma `arsiv/mobil-ilk-deneme/` altında kullanım dışı tutulur; yeni uygulamanın derlemesine katılmaz. Masaüstündeki Pusula referans projesi değiştirilmemiştir.
