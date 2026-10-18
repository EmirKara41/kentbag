# KentBağ · Belediye Çözüm Merkezi

İkinci blok: belediye merkez biriminin web paneli. Vatandaş uygulaması ve saha ekibi entegrasyonu bu blokta açılmaz. Veriler açıkça örnektir; işlemler yalnız bu tarayıcıda kalır. Kurum hesabı, gerçek mesaj gönderimi veya çalışan bir saha bağlantısı varmış gibi gösterilmez.

## Çalıştırma

Node.js 22+ ile, bu klasörde:

```powershell
npm ci
npm run dev
```

Panel: http://localhost:4280/. Vatandaş önizlemesinin 4173 portu bağımsız kalır.

```powershell
npm run typecheck
npm test
npm run test:ui
npm run build
```

Üretim çıktısı `dist/` altındadır. Harita ayrı parçada, yalnız harita ekranı açılınca yüklenir. Uygulama kimlik veya sunucu anahtarı içermez. Bu turda internet yayını yapılmaz; mevcut Vercel API ile canlı bağlantı son aşamaya bırakılmıştır.

## İlk sürümdeki ekranlar

- **Genel bakış:** Devam eden işler, atama bekleyenler, ekip atamaları ve çözüm bildirilen kayıtlar örnek verilerden hesaplanır. Öncelikli iş kuyruğu, ortak bölge olayları, birim dağılımı ve vatandaş geri dönüşleri görünür.
- **Talepler:** Arıza ve iyileştirme ayrımı, durum/kategori/öncelik filtresi, Türkçe arama ve örnek olarak işaretlenen CSV çıktısı. Sayılar destek veya benzersiz kişi sayısı yerine geçmez.
- **Talep ayrıntısı:** Adres, kurumca belirlenen öncelik, uygun birim/ekip atama, kurum içi not, vatandaşa açık açıklama, süreç geçmişi, vatandaş görünümü, çözüm bildirimi ve gerekçeyle yeniden inceleme. Görev alamayan veya farklı birime ait ekip seçilemez. Çözüm bildirmek vatandaş onayı değildir.
- **Harita:** Örnek talep noktaları. Koordinatsız elle adresler soldaki listede kalır; adreslerden nokta uydurulmaz. OSM yüklenmezse CARTO denenir; ikisi de başarısızsa kayıt listesi çalışır. Ekiplerin canlı konumu gösterilmez.
- **Bölge duyuruları:** Taslak/yayında/tamamlanan örnek duyurular. Açıklama, etkilenen bölge, tahmini bitiş, aynı kategorideki ilişkili talepler ve vatandaş önizlemesi. Bir kayıt aynı anda iki ortak olaya bağlanmaz. Bağlanan talepler silinmez veya otomatik tamamlanmaz.
- **Çalışmalar ve sonuçlar:** Planlanan/devam eden/tamamlanan çalışmalar, karşılanan ihtiyaç ve ilgili talepler. Çalışma sayısı ve tekil ilişkili talep sayısı ayrı hesaplanır. Tamamlanan çalışma ilişkili talepleri kendiliğinden kapatmaz.
- **Birimler ve ekipler:** Ekiplerin aktif yükü, yeni görev alabilirliği ve görevleri. Elektrik dağıtım kurumu gibi dış sorumlular için yönlendirme kaydı tutulur; teslim teyidi veya müdahale gerçekleşmiş gibi ifade edilmez.
- **İşlem geçmişi:** Örnek kurum işlemlerinin kaydı. Kamuya açık açıklamalarla kurum içi kayıtlar ayrıdır.

## Kalıcılık ve sınırlar

Tarayıcıda `kentbag-panel-demo-v1` anahtarı altında sürümlü örnek durum tutulur. Tarayıcı yenilemesi atamaları ve düzenlemeleri korur. Depolama başarısızsa işlem uygulanmaz ve hata gösterilir. Örnekleri sıfırlamak onay ister; mobil uygulamanın kayıtlarına dokunmaz. Tarayıcı verilerini temizlemek bu örnek çalışmayı siler.

Bu bir üretim yetkilendirme sistemi değildir. Yan menüdeki operatör ve belediye örnektir. Gerçek vatandaş verileri, fotoğraf servisi, ekipten gelen sonuç kanıtı, e-posta/push, çoklu kurum yetkisi ve kullanıcı yönetimi henüz bağlı değildir. Görsel etiketleme/öncelik için yapay zekâ kullanılmaz; kurum önceliği elle belirler.

## Üçüncü bloktan sonra bağlantı

1. Saha uygulamasında görevi alma, durumu güncelleme ve sonuç açıklaması/fotoğrafı akışı tamamlanır.
2. Belediye kapsamı ve rol izinleri sunucuda doğrulanır. Vatandaş oturumu kurum işlemleri yapamaz; istemciden gelen rol/kurum kimliğine güvenilmez.
3. Panelin yerel durum katmanı yetkili API katmanıyla değiştirilir. Vatandaş kayıtlarının kategori, tür, konum, durum, işlem geçmişi ve çözüm geri dönüşleri eşleştirilir. Panelin başlık, öncelik, birim ve ekip alanları kurum sözleşmesinde ayrıca tanımlanır.
4. Duyurular ve çalışma sonuçları, kurum içi notlar ve özel vatandaş bilgileri ayıklanarak mobil yayına aktarılır. API'ye kayıt ve bildirimin teslimi ayrı izlenir.
5. Gerçek akış vatandaş → merkez → ekip → sonuç → vatandaş geri dönüşü olarak uçtan uca doğrulanır.

Dosya düzeni: `src/domain.ts` veri modeli ve işlem kuralları; `fixtures.ts` tamamen örnek kayıtlar; `store.tsx` yerel kalıcılık; `Reports.tsx`, `Announcements.tsx`, `MapView.tsx`, `App.tsx` ekranlar. Test sonuçları ve ekran görüntüleri Git dışında `artifacts/` içinde tutulur.
