# KentBağ

Vatandaş, belediye merkezi ve saha ekiplerini aynı talep sürecinde buluşturan uygulama.

Proje adı KentBağ'dır. Mevcut vatandaş uygulamasının görünen adı KentYanımda, Android paket kimliği `com.kentyanimda.vatandas` olarak korunur; kurulu uygulamalar sonraki paketlerle güncellenebilir.

- `mobil/`: Android vatandaş uygulaması. Bölge ana sayfası, aktif olaylar, iyileştirme istekleri, tamamlanan kişisel talepler, kamera/galeri, GPS/harita ve hesap ekranları APK'nın içindedir. [Yeni deneyim ve bağlantı sınırları](mobil/URUN_DENEYIMI.md).
- `sunucu/`: Vercel üzerinde çalışacak API; Better Auth ile giriş, PostgreSQL kayıtları ve özel Vercel Blob fotoğrafları.

Sunucu Vercel için hazırlanmıştır. Canlı API ve depolar henüz dağıtılmamıştır. Hesap hizmeti açılana kadar kullanıcı menülerde gezinebilir, fotoğraf/konum ekleyebilir ve taslak hazırlayabilir; sunucuya gönderilmiş gibi başarı gösterilmez. Merkez ve ekip ekranları sonraki bloktur.

Android uygulaması yardımcı uygulama veya açık bilgisayar gerektirmez. APK hazırlama/indirme: [mobil kılavuzu](mobil/README.md). Sunucuyu bağlama: [Vercel kurulumu](sunucu/README.md). Kabul edilen ürün kapsamı: [kapsam](URUN_KAPSAMI.md).

Önceki mobil çalışma `arsiv/mobil-ilk-deneme/` altında kullanım dışı tutulur; yeni uygulamanın derlemesine katılmaz. Masaüstündeki Pusula referans projesi değiştirilmemiştir.
