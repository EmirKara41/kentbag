# Belediye–Vatandaş Köprüsü: İlk Sürüm Kapsamı

Güncelleme: 18 Ekim 2026

Bu belge görüşmede kabul edilen kapsamı ve önerilen kuralları toplar. 18 Ekim 2026'da önceki mobil çalışma kullanım dışına alınarak `mobil/` altında yeni Android uygulaması kuruldu. Beklenen deneyim: doğrudan kurulan APK, uygulamanın içinde gömülü menü ve ekranlar, uygulama içinden kamera/konum, internet üzerinden hesap ve talepler. Kullanıcı yardımcı uygulama veya geliştirme sunucusuyla uğraşmaz. Vercel API `sunucu/` klasöründedir. Canlı API ve depolar henüz dağıtılmamıştır; bu aşamada taslak hazırlanabilir, gönderim başarısı uydurulmaz. Merkez birim, saha ekibi, uzaktan bildirim ve Gemini bağlantısı sonraki bloklardır.

## Amaç

Vatandaşın bildirdiği sorunun sahiplenilmesini, gerçek işlem adımlarını takip edebilmesini ve sonuç hakkında geri bildirim verebilmesini sağlamak. Çözülemeyen taleplerde gerekçe ve sonraki adım görünür olmalıdır.

## Kabul edilen deneyim güncellemesi · 1.1.0

Uygulama arıza takibi ile mahalle iyileştirme isteklerini birleştirir. Aktif olayları bir kez yayımlama, aynı durumdan etkilenenlerin takibi, ortak isteklerin desteklenmesi, tamamlanan çalışmaların karşıladığı ihtiyaçlarla sunulması hedeflenir. Kişisel tamamlanan talepler silinmeden arşivlenir. Karar ve kaynak tahsisi kurumundur; uygulama destek sayısı, etki kategorisi ve süreç bilgisi sunar. Talep/destek/kişi/çalışma sayıları birbirinin yerine kullanılmaz. Ödül sistemi henüz kapsam dışındadır.

Mobil uygulamadaki bu turun davranışı ve örnek/canlı ayrımı [deneyim notlarında](mobil/URUN_DENEYIMI.md) kayıtlıdır. Yayın servisi bağlanana kadar mahalle içerikleri açıkça örnektir; kişisel kayıtlar uydurulmaz. “Sorun devam ediyor” geri dönüşü kaydedilir ve kişisel devam edenler listesine yansır; otomatik kurum işlemi başlatılmış gibi gösterilmez.

## Kabul edilen kapsam

İkinci blok `panel/` altında yerel belediye çalışma alanı olarak başlatıldı. Panelin örnek atama, duyuru ve sonuç akışları mobil uygulamadan bağımsızdır. Üçüncü saha bloğundan sonra roller, API ve canlı yayın birlikte bağlanacaktır; [panel kılavuzu](panel/README.md) mevcut sınırları açıklar.

- Tek sistem içinde vatandaş, belediye merkez birimi ve saha ekibi için ayrı yetkiler ve ekranlar.
- İlk geliştirme bloğu Android vatandaş uygulamasıdır. Merkez ve ekip modülleri ayrı geliştirildikten sonra bağlanacaktır.
- İlk sorun kategorileri: elektrik kesintisi, su kesintisi, çöp birikmesi, yol hasarı ve buzlanma.
- Konum, kategori, kısa açıklama ve gerektiğinde fotoğrafla talep oluşturma.
- Sorumlu birim ve ekip atama; bekleyen ve geciken işleri izleme.
- Gerçek işlem değişikliklerine bağlı bildirimler ve zaman çizelgesi.
- Saha ekibinin sonuç açıklaması ve uygun işlerde sonuç fotoğrafı yüklemesi.
- Vatandaşın çözümü doğrulayabilmesi; sorun devam ediyorsa aynı kayıt üzerinden yeniden inceleme.
- Aynı olayın bildirimlerini bir iş altında birleştirme; bildiren herkesi gelişmelerden haberdar etme.
- Yetki dışı taleplerde sorumlu kurum ve yönlendirme durumunu açıkça gösterme.
- Görsellerin bildirimle ilişkisini değerlendiren ön kontrol. İlk sağlayıcı Gemini; daha sonra yerel modelle değiştirebilme.
- Sınırlı bir bölgede pilot; çözüm süresi, bekleyen talepler, tekrar açılma ve vatandaş onayının izlenmesi.

## Önerilen kategori kuralları

| Kategori | Öncelikli bilgi | Fotoğrafın rolü |
| --- | --- | --- |
| Elektrik kesintisi | Konum, başlangıç zamanı biliniyorsa, daire/bina/sokak gibi etki alanı | İsteğe bağlı destek. Fotoğrafla kesintinin gerçekliği doğrulanmaz. |
| Su kesintisi | Konum, başlangıç zamanı biliniyorsa, etki alanı | İsteğe bağlı destek. Fotoğrafla kesintinin gerçekliği doğrulanmaz. |
| Çöp birikmesi | Konum ve kısa açıklama | Fotoğraf teşvik edilir; çöp veya dolu konteyner gibi ilgili bulgular aranır. |
| Yol hasarı | Konum ve kısa açıklama | Fotoğraf teşvik edilir; çukur, çatlak veya yüzey bozulması gibi ilgili bulgular aranır. |
| Buzlanma | Konum, gözlem zamanı ve kısa açıklama | İsteğe bağlı destek. Görünür buz/kar aranabilir; sıradan ıslak veya karanlık yol görüntüsü kesin karar için yeterli sayılmaz. |

Fotoğraf çekemeyen vatandaş açıklamayla talep oluşturabilmelidir. Görsel uygunluğu kontrolü, talebin doğru konumda ve zamanda yaşandığını kanıtlamaz. Sorumlu kurum eşleştirmeleri pilot bölge için ayrıca yapılandırılmalıdır.

## Önerilen talep akışı

Alındı → İnceleniyor → Ekibe atandı → Çalışma başladı → Çözüm bildirildi → Tamamlandı

- Her aktif talebin belediye içinde bir sorumlu birimi bulunur.
- Görsel analiz sonucu ile talebin işlem durumu ayrı tutulur.
- Çözüm bildirildiğinde vatandaşa "Sorununuz giderildi mi?" sorulur.
- "Sorun devam ediyor" yanıtı yeniden inceleme ihtiyacını kuruma iletir; eski işlemler korunur. Yeniden görevlendirme yetkili kurumun işlemidir. Bu mobil blokta yanıt kaydedilir ve kişisel devam edenler listesine yansır.
- Yanıt gelmeyen kayıtların kapanma süresi ve kuralı pilot öncesinde belirlenir. Yanıt gelmemesi vatandaş onayı olarak kaydedilmez.
- Bekleme ve gecikme gerekçesi işlem geçmişine eklenir. Tahmini tarih, ilgili birim tarafından güncellenir.
- Dış kuruma yönlendirme çözüm olarak kaydedilmez. Teslim veya işlem teyidi yoksa "ilgili kuruma iletildi" denmez; yapılan adım doğru biçimde gösterilir.
- Kesinti gibi fotoğrafla doğrulanamayan işlerde sonuç kaynağı ve açıklama kaydedilir; fotoğraf zorunlu kapanış kanıtı değildir.

## Önerilen görsel ön kontrol

Kategori, açıklama ve görsel birlikte değerlendirilir. Model yalnızca görselde gözlenebilen ilişkiyi raporlar.

| Sonuç | Uygulama davranışı |
| --- | --- |
| Uygun | Görsel bildirime eklenir; olağan iş akışı sürer. |
| İlgisiz | Vatandaşa açıklama gösterilir; görseli değiştirme, kaldırma veya gerekçeyle insan incelemesine gönderme imkânı verilir. |
| Belirsiz | Görsel daha açık çekilebilir; mevcut taleple devam edilirse merkez birim inceler. |
| Değerlendirilemedi | Servis hatası veya zaman aşımı talebi engellemez; analiz daha sonra denenir veya insan incelemesine bırakılır. |

Örnekler:

- "Yol hasarı" ve yalnızca Boğaz manzarası: ilgili yol/hasar bulgusu yoksa ilgisiz.
- Boğaz manzarasının önünde görünür yol çukuru: arka plan nedeniyle reddedilmez; ilgili bulgu değerlendirilir.
- Karanlık ve bulanık yol: belirsiz.
- Islak asfalt ve "buzlanma" açıklaması: görselden ayrım yapılamıyorsa belirsiz.
- Elektrik kesintisi ve karanlık oda: kesintiyi doğrulamaz; fotoğrafın destekleyici bağlamı değerlendirilir.

Model sonucu kötü niyet, sahtekârlık, kesin öncelik veya çözüm onayı olarak kullanılmaz. Talep ve fotoğraf otomatik silinmez. Görseldeki yazılar talimat olarak uygulanmaz. İstemci tarafından iletilen analiz kararı güvenilir kabul edilmez; doğrulama sunucu tarafında yürütülür.

## Gemini’den yerel modele geçiş

Öneri: Uygulama tek bir görsel değerlendirme arayüzüyle çalışır. Sağlayıcı seçimi uygulama ayarından yapılır; belediye iş akışı sağlayıcıya bağlanmaz.

- Girdi: kategori, açıklama, görsel.
- Çıktı: uygun / ilgisiz / belirsiz; gözlenen bulgular; kısa Türkçe gerekçe.
- Servis hatası, modelin belirsiz yanıtından ayrı kaydedilir.
- Sağlayıcı, model sürümü, istem sürümü ve değerlendirme zamanı saklanır.
- API anahtarı sunucuda tutulur. İsim, telefon ve kimlik bilgileri görsel değerlendirme isteğine eklenmez.
- Sonuç biçimi sunucuda doğrulanır. Biçimin doğru olması değerlendirmenin doğru olduğu anlamına gelmez.
- Yerel modele geçmeden önce aynı etiketli örneklerde karşılaştırma yapılır. Özellikle gerçek bir bildirimin yanlışlıkla ilgisiz bulunması ölçülür.

İlk doğrulama örnekleri; gerçek çöp/yol fotoğrafları, ilgisiz manzaralar, manzarayla aynı karede görünen sorunlar, gece görüntüleri, bulanık fotoğraflar ve buz/ıslak asfalt gibi belirsiz durumları içermelidir.

## Pilot öncesinde netleştirilecekler

- Pilot belediye/bölge ve kategori başına sorumlu birimler veya dış kurumlar.
- Vatandaşın kimlik doğrulama yöntemi ve bildirim kanalı.
- Öncelik, bekleme ve vatandaş yanıtı gelmeyen kayıtların kapanma kuralları.
- İlk pilot için uygulamanın dağıtım yöntemi ve gerçek hesaplara geçiş. Güncel modül Android için React/Capacitor ile gömülü APK'dır; tarayıcı önizlemesi de vardır. Eski Expo uygulaması kullanım dışıdır.

## Teknik kaynaklar

- [Gemini görsel anlama](https://ai.google.dev/gemini-api/docs/image-understanding): Görsellerle sınıflandırma ve görsel soru-cevap desteği.
- [Gemini yapılandırılmış çıktılar](https://ai.google.dev/gemini-api/docs/structured-output): Ortak sonuç şeması oluşturmak için kullanılabilecek destek.
