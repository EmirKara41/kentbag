# KentBağ

Vatandaş, belediye merkezi ve saha ekiplerini aynı talep sürecinde buluşturan uygulama.

Proje adı KentBağ'dır. Mevcut vatandaş uygulamasının görünen adı KentYanımda, Android paket kimliği `com.kentyanimda.vatandas` olarak korunur; kurulu uygulamalar sonraki paketlerle güncellenebilir.

Vatandaş **Android 1.4.2** giriş ekranına şifre alanının altında **Şifremi unuttum** bağlantısı eklendi. [Güncel vatandaş APK ve QR](https://kentbag-panel-emir-kara-s-projects.vercel.app/indir/). Mevcut kurulumun üzerine güncellenir. Bu geliştirmede saha uygulaması değiştirilmedi.

11 Kasım 2026: **Saha 0.1.2** girişine **Şifremi unuttum** eklendi. [Web kurtarma sayfası](https://kentbag-panel-emir-kara-s-projects.vercel.app/sifre-sifirla) APK güncellenmeden de kullanılabilir. E-posta bağlantısı doğrudan hesap sahibine gider, 30 dakika geçerlidir ve tek kullanımlıktır. Şifre yenilenirken eski oturumlar kapatılır; kayıtlar ve personel yetkisi korunur.

7 Kasım 2026: **Saha 0.1.1** giriş ekranına hesap oluşturma eklendi. Yeni veya mevcut vatandaş hesabı kurum/ekip başvurusu yapabilir; merkez **Personel hesapları → Saha hesabı başvuruları** bölümünden onaylayınca saha görevlerine erişir. Başvurunun bekleme/ret durumu kalıcıdır; onay merkez/kurum yetkisi vermez. [Güncel hesap açma ve deneme adımları](SAHA_DENEME.md).

5 Kasım 2026: Ayrı **KentBağ Saha 0.1.0** Android uygulaması ve kurum → ekip → kurum kontrolü → merkez onayı → talep sahibi/takipçiler akışı eklendi. [Saha APK ve QR](https://kentbag-panel-emir-kara-s-projects.vercel.app/saha/indir/), [saha kılavuzu](saha/README.md). Vatandaş Android **1.4.1** onaylanan sonuç fotoğraflarını takipçilere de gösterir; [vatandaş APK ve QR](https://kentbag-panel-emir-kara-s-projects.vercel.app/indir/). [İnternet demosu, bağlantılar ve sınırlar](INTERNET_DEMOSU.md). Aşağıdaki yerel pilot açıklamaları eski 1.3.x paketlerine ve yerel geliştirmeye aittir.

- `mobil/`: Android vatandaş uygulaması. Bölge ana sayfası, aktif olaylar, iyileştirme istekleri, tamamlanan kişisel talepler, kamera/galeri, GPS/harita ve hesap ekranları APK'nın içindedir. [Yeni deneyim ve bağlantı sınırları](mobil/URUN_DENEYIMI.md).
- `sunucu/`: Vercel üzerinde çalışacak API; Better Auth ile giriş, PostgreSQL kayıtları ve özel Vercel Blob fotoğrafları.
- `panel/`: Belediye merkez biriminin web paneli. Oltu yerel pilotunda gerçek vatandaş taleplerine bağlıdır; örnek çalışma alanı ayrıca açılabilir. [Panel kılavuzu](panel/README.md).
- `saha/`: Kurum ve ekip hesabına göre görev gösteren ayrı Android saha uygulaması; görev kabulü, kamera/galeri, sonuç gönderimi ve kontrol durumları.

İnternet demosunda Vercel API, Neon veritabanı ve özel Blob fotoğraf deposu kullanılır; bilgisayarın açık olması gerekmez. Yerel geliştirmede kalıcı yerel veritabanı ayrıca desteklenir. Aciliyet önerisi Gemini anahtarı yokken gerekçeli kurallarla, anahtar eklenince Gemini ile üretilir; yetkili kararı ayrı tutulur.

Android menüleri APK içine gömülüdür; yardımcı uygulama gerekmez. Bu yerel pilotta kayıt göndermek ve güncelleme almak için telefon aynı ağda olmalı ve bilgisayardaki API açık kalmalıdır. [Yerel deneme ve yeniden başlatma](YEREL_DENEME.md). APK hazırlama/indirme: [mobil kılavuzu](mobil/README.md). [Vercel kurulumu](sunucu/README.md). Kabul edilen ürün kapsamı: [kapsam](URUN_KAPSAMI.md).

Android 1.3.0 ile **Bildir** önce paylaşılmış açık sorunları gösterir. Vatandaş GPS/harita ile yaklaşık 5 km çevresine veya mahalle seçerek bölgesine bakabilir; mevcut soruna **Ben de etkileniyorum** diyebilir veya **Farklı bir sorun bildir** ile yeni kayıt açabilir. Katılımlar **Kayıtlarım → Katıldıklarım** altında hesap bazında saklanır; katılım yeni talep oluşturmaz. Aynı hesap aynı kayda bir kez katılır, istediğinde takibi bırakabilir.

Android 1.3.1 talep ayrıntılarında kurumun yazdığı açıklamaları **Çözüm merkezinden mesajlar** alanında öne çıkarır. Art arda aynı otomatik işlem kayıtları, eski veriler silinmeden açılabilir bir tekrar grubunda gösterilir. Panel ve API aynı birim/ekip atamasını tekrar kaydederek yeni bildirim üretmez veya devam eden çalışmayı geriye götürmez.

Paylaşım yalnız kategori, mahalle, yaklaşık konum (koordinatlar üç ondalığa yuvarlanır), durum ve ortak açıklamaları kapsar. İsim, asıl açıklama, açık adres, fotoğraflar ve kişiye özel yanıtlar paylaşılmaz. Yeni formda paylaşım tercihi görünür; eski talepler otomatik yayımlanmaz. Talep sahibi ayrıntı ekranından paylaşımı açıp kapatabilir. Elle yazılmış adres için harita noktası uydurulmaz; kayıt bölge listesinde görünür. Panelde **Talep sahibine yanıt** özel kalır; paylaşılan kayıtta **Ortak güncelleme · Katılan herkese** ortak geçmişe ve katılan hesapların uygulama içi güncellemelerine gider. Durum değişiklikleri de katılanlara iletilir. İşletim sistemi push bildirimi bu sürüme dahil değildir.

Önceki mobil çalışma `arsiv/mobil-ilk-deneme/` altında kullanım dışı tutulur; yeni uygulamanın derlemesine katılmaz. Masaüstündeki Pusula referans projesi değiştirilmemiştir.

Panel 0.3.0, Yol/Fen İşleri, Elektrik, Su, Temizlik ve Parklar için `/kurumlar` altında ayrı pilot kuyruklar sunar. Merkezden açıkça gönderilen talep kurumda incelemeye alınabilir, gerekçeyle iade edilebilir veya hedef ekip için kalıcı görev emri hazırlanabilir. Kurum yalnız kendi taleplerine erişir. Saha uygulaması henüz bağlı olmadığı için emirler teslim bekleyen hazırlık kayıtlarıdır. [Kurum modülü ve kullanım](panel/KURUMLAR.md).
