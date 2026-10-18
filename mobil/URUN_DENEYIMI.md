# Vatandaş deneyimi · 1.1.1

## 1.1.1 küçük düzenlemeler

Bildirim formundaki “Neyi etkiliyor?” seçimi kaldırıldı. Önceden kaydedilmiş etki bilgileri silinmez; yeni bildirimlerde bu seçim sorulmaz. Ana sayfadaki karşılama yazıları ve yanındaki dekoratif simge çıkarıldı; alan gelecekte kullanılmak üzere 6 px yüksekliğinde boş bırakıldı.

Konum adımında “Haritadan seç” ve “Adresi elle yaz” seçenekleri vardır. Açık adres GPS izni veya harita noktası olmadan yazılıp saklanabilir ve gönderilebilir. Adres 10–500 karakter olmalıdır; il/ilçe/mahalle/sokak/kapı numarasıyla ayrıntılandırılması istenir. Elle girilen adres için koordinat uydurulmaz, otomatik coğrafi kodlama yapılmaz ve yakındaki olay eşleştirmesi çalıştırılmaz. İnceleme ve detay ekranı bu kaydı harita noktası olmadan gösterir. Elle yazılan metin yöntem değişiminde ve taslağı yeniden açarken korunur. Profilin harita konumu sözleşmesi değişmez.

18 Ekim 2026. Bu değişiklik vatandaş mobil uygulamasına uygulanmıştır. Merkez ve ekip ekranları yapılmamıştır.

## Ana sayfa ve gezinme

Seçilebilir bölge başlığı, bölgedeki son olay, arıza/iyileştirme girişleri, kişisel son durum, tamamlanan talepler arşivi, diğer gelişmeler ve sonuçlanan çalışmalar bulunur. Alt menü: Ana sayfa, Kayıtlarım, Bildir, Mahallem, Hesabım. Güncellemeler üstteki zil ile açılır.

Bölge elle seçilerek bu cihazda saklanabilir. Seçim yoksa profil mahallesi, o da yoksa son bildirimin adres tarifi kullanılır. Bu bilgi ev adresi olarak yorumlanmaz. Otomatik adres/mahalle çözümleme ve arka plan konum takibi yapılmaz.

## Arıza ve iyileştirme

Arızalar: elektrik, su, çöp, yol hasarı, buzlanma. İyileştirme: kaldırım, aydınlatma, erişilebilirlik, park/ortak alan. Talep türü kategoriyle birlikte API'de doğrulanır. Önceki sürümün etki etiketleri eski kayıtlar için okunabilir; yeni form bu alanı sormaz. Otomatik karar, yapay zekâ aciliyet puanı veya kurum öncelik sırası oluşturulmaz.

Konum ve kategori seçilince 1,5 km içindeki ilgili örnek olaylar gösterilir. Ayrıntıya gidip dönmek taslağı ve adıma ait bilgileri korur. Eşleşme farklı bir bildirim oluşturmaya engel olmaz.

## Mahallem

Aktif olaylar, ortak iyileştirme istekleri ve tamamlanan çalışmalar ayrı sekmelerdedir. Olay/istek ayrıntısında açıklama ve gelişme çizelgesi bulunur. Destek vermek takibi de başlatır; destek ve takip ayrı ayrı geri alınabilir. Takip edilenler filtrelenebilir. Destek miktarı vatandaş sayısı veya gerçek etki sayısı olarak sunulmaz.

Mevcut yayın tamamen örnektir; kart ve ayrıntılarda açıkça belirtilir. Destek ve takip tercihleri bu cihazda saklanır; belediyeye iletilmez, uzaktan bildirim üretmez. Örnekler gizlenebilir ve tercih yeniden açılışta korunur. Örnek kayıtlar hiçbir zaman kişisel taleplere eklenmez. Bölgeyi değiştirmek örnekleri gerçek bölge verisine dönüştürmez.

Canlı yayın için sonraki blok: kurumun yayımlayacağı olay/çalışma kayıtları, bölge eşleştirmesi, kimlik doğrulamalı destek/takip servisi, bildirim kanalı ve yayın denetimi. Vatandaşın özel fotoğraf ve konumu kendiliğinden herkese açılmaz.

## Tamamlanan taleplerim

Ana sayfadan, Kayıtlarım filtresinden ve Hesabım'dan erişilir. Kişisel API kayıtları korunur, çözüm tarihiyle sıralanır, sayısı gösterilir. `resolved` ve `closed` kayıtları yer alır; geri çekilenler tamamlanan sayısına dahil edilmez. Kurum çözüm bildirdi ve vatandaş çözüldüğünü onayladı ayrı ifadelerle gösterilir.

Kişisel ayrıntıdaki aşama şeridi ve tarihli işlem geçmişi yalnız sunucunun bildirdiği durumu gösterir. Kurumun sonuç açıklaması/fotoğrafı varsa uygulama içinde incelenebilir. Kurum çözüm bildirdikten sonra vatandaş “Çözüldü” veya “Sorun devam ediyor” cevabını isteğe bağlı açıklamayla kaydedebilir. Geri dönüş sadece kayıt sahibince, yalnız çözüm bildirilmiş durumda gönderilebilir. Geri dönüş geçmişi saklanır; aynı yanıtın tekrar gönderimi geçmişi şişirmez.

Sorun devam ediyor cevabı kaydı kişisel devam edenler listesine getirir ve tamamlanan sayısından çıkarır. Kurumun resmi durumu değiştirilmez, otomatik ekip ataması yapılmış gibi gösterilmez. Yeniden inceleme/görevlendirme merkezi sistemin sonraki işidir.

Ortak tamamlanan çalışma örneğinde önce/sonra temsili çizimleri, karşılanan ihtiyaç ve ilişkili örnek talep sayısı vardır. Çizimler fotoğraf olarak sunulmaz. Planlı bir çalışmanın ihtiyacı karşılaması, kararın vatandaş isteği yüzünden verildiği iddiasından ayrı tutulur.

## Canlı bağlantı durumu

APK'da canlı API adresi henüz yoktur. Hesap açma, gönderim ve kişisel sonuç kayıtlarının günlük kullanımı gerçek HTTPS hizmetini bekler. Hazırlama, kamera/galeri, konum, taslak, gezinme ve örnek mahalle akışı kullanılabilir. API ve kişisel arşiv/geri dönüş akışı ayrı test ortamında gerçek HTTP, Better Auth ve PostgreSQL ile doğrulanır. Test sunucusunun durum değiştirme yolları yalnız `sunucu/tests/mobile-server.ts` içindedir, üretim API'sine veya APK'ya dahil değildir.
