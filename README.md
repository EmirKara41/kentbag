# KentBağ

Vatandaş, belediye merkezi ve saha ekiplerini aynı talep sürecinde buluşturan uygulama.

Proje adı KentBağ'dır. Mevcut vatandaş uygulamasının görünen adı KentYanımda, Android paket kimliği `com.kentyanimda.vatandas` olarak korunur; kurulu uygulamalar sonraki paketlerle güncellenebilir.

- `mobil/`: Android vatandaş uygulaması. Bölge ana sayfası, aktif olaylar, iyileştirme istekleri, tamamlanan kişisel talepler, kamera/galeri, GPS/harita ve hesap ekranları APK'nın içindedir. [Yeni deneyim ve bağlantı sınırları](mobil/URUN_DENEYIMI.md).
- `sunucu/`: Vercel üzerinde çalışacak API; Better Auth ile giriş, PostgreSQL kayıtları ve özel Vercel Blob fotoğrafları.
- `panel/`: Belediye merkez biriminin web paneli. Oltu yerel pilotunda gerçek vatandaş taleplerine bağlıdır; örnek çalışma alanı ayrıca açılabilir. [Panel kılavuzu](panel/README.md).

Oltu pilotunda vatandaş → yerel API → belediye paneli ve panel → vatandaş durum/açıklama/çözüm akışı bağlıdır. Gerçek hesaplar, talepler ve fotoğraflar bilgisayarda kalıcı saklanır. Aciliyet önerisi Gemini anahtarı yokken gerekçeli kurallarla, anahtar eklenince Gemini ile üretilir; yetkili kararı ayrı tutulur. İnternetteki Vercel/Neon/Blob üretim kaynakları henüz dağıtılmadı. Saha uygulaması üçüncü bloktur.

Android menüleri APK içine gömülüdür; yardımcı uygulama gerekmez. Bu yerel pilotta kayıt göndermek ve güncelleme almak için telefon aynı ağda olmalı ve bilgisayardaki API açık kalmalıdır. [Yerel deneme ve yeniden başlatma](YEREL_DENEME.md). APK hazırlama/indirme: [mobil kılavuzu](mobil/README.md). [Vercel kurulumu](sunucu/README.md). Kabul edilen ürün kapsamı: [kapsam](URUN_KAPSAMI.md).

Android 1.3.0 ile **Bildir** önce paylaşılmış açık sorunları gösterir. Vatandaş GPS/harita ile yaklaşık 5 km çevresine veya mahalle seçerek bölgesine bakabilir; mevcut soruna **Ben de etkileniyorum** diyebilir veya **Farklı bir sorun bildir** ile yeni kayıt açabilir. Katılımlar **Kayıtlarım → Katıldıklarım** altında hesap bazında saklanır; katılım yeni talep oluşturmaz. Aynı hesap aynı kayda bir kez katılır, istediğinde takibi bırakabilir.

Android 1.3.1 talep ayrıntılarında kurumun yazdığı açıklamaları **Çözüm merkezinden mesajlar** alanında öne çıkarır. Art arda aynı otomatik işlem kayıtları, eski veriler silinmeden açılabilir bir tekrar grubunda gösterilir. Panel ve API aynı birim/ekip atamasını tekrar kaydederek yeni bildirim üretmez veya devam eden çalışmayı geriye götürmez.

Paylaşım yalnız kategori, mahalle, yaklaşık konum (koordinatlar üç ondalığa yuvarlanır), durum ve ortak açıklamaları kapsar. İsim, asıl açıklama, açık adres, fotoğraflar ve kişiye özel yanıtlar paylaşılmaz. Yeni formda paylaşım tercihi görünür; eski talepler otomatik yayımlanmaz. Talep sahibi ayrıntı ekranından paylaşımı açıp kapatabilir. Elle yazılmış adres için harita noktası uydurulmaz; kayıt bölge listesinde görünür. Panelde **Talep sahibine yanıt** özel kalır; paylaşılan kayıtta **Ortak güncelleme · Katılan herkese** ortak geçmişe ve katılan hesapların uygulama içi güncellemelerine gider. Durum değişiklikleri de katılanlara iletilir. İşletim sistemi push bildirimi bu sürüme dahil değildir.

Önceki mobil çalışma `arsiv/mobil-ilk-deneme/` altında kullanım dışı tutulur; yeni uygulamanın derlemesine katılmaz. Masaüstündeki Pusula referans projesi değiştirilmemiştir.

Panel 0.3.0, Yol/Fen İşleri, Elektrik, Su, Temizlik ve Parklar için `/kurumlar` altında ayrı pilot kuyruklar sunar. Merkezden açıkça gönderilen talep kurumda incelemeye alınabilir, gerekçeyle iade edilebilir veya hedef ekip için kalıcı görev emri hazırlanabilir. Kurum yalnız kendi taleplerine erişir. Saha uygulaması henüz bağlı olmadığı için emirler teslim bekleyen hazırlık kayıtlarıdır. [Kurum modülü ve kullanım](panel/KURUMLAR.md).
