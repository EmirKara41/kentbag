# KentBağ v2 · Tasarım belgesi

Tarih: 12 Kasım 2026 · Teslim: ders sunumu, 18 Kasım 2026 (6 gün)

## 1. Neden yeniden

Mevcut sistem (yedek: `C:\Users\emirk\KentBag-Yedek-2026-11-12`, git etiketi
`yedek-2026-11-12`) teknik olarak çalışıyor ama kullanılamıyor:

- Mobilden gönderilen bir bildirim merkez paneline düşmedi; sebep bilinmiyor.
- Bir sorunun sahaya ulaşması yaklaşık 7 elle adım istiyor (merkez kuruma
  gönderir → kurum teslim alır → kurum görev emri hazırlar → ekip kabul eder →
  ekip başlatır → kurum kontrol eder → merkez yayınlar).
- Arayüzler kalabalık, roller ve hesaplar kafa karıştırıcı; geliştiren kişi
  bile neyin nerede olduğunu anlamıyor.

Amaç: aynı problemi (vatandaş sorunu → doğru kurum → doğru ekip → çözüm)
kargo takibi kadar kolay izlenebilir, olabildiğince otomatik ve sade bir
sistemle çözmek.

## 2. Başarı tanımı

Sunum günü, bir kişi canlı sistemde şunu kesintisiz gösterebilmeli:

1. Vatandaş telefondan "elektrik kesildi" bildirir.
2. Yapay zekâ ajanı birkaç saniye içinde talebi Elektrik kurumuna ve uygun
   ekibe atar; gerekçesini gösterir.
3. Ekip telefonunda işi görür, "yola çıktım" der; vatandaş "ekip yolda ·
   tahmini varış 14:30" görür ve bildirim alır.
4. Ekip "vardım" der (tahmini çözüm süresi görünür), sonra fotoğrafla "bitti"
   der; vatandaşa anında bildirim gider, talep kapanır.
5. Vatandaş "sorun devam ediyor" derse talep yeniden açılır ve ajan yeniden
   atar.
6. Ajan kapatılıp aynı işler merkez ve kurum sitesinden elle yapılabilir.

Ek özellikler (bölüm 7) de çalışır durumda olmalı, ama ana akış önceliklidir.

## 3. Hedefler, hedef olmayanlar, kaçınılacaklar

Hedefler:
- Ana akış en fazla iki insan dokunuşuyla tamamlanır: vatandaşın bildirimi ve
  ekibin işi. Ajan açıkken yönlendirme ve atama otomatiktir.
- Her rol için tek, sade bir ana ekran; "şimdi ne yapmalıyım" her zaman belli.
- Vatandaş ve takip edenler süreci canlı izler (durum + tahmini süreler).
- Bir bildirim asla sessizce kaybolmaz (bkz. 6.6).

Hedef olmayanlar:
- Gerçek belediye/dağıtım şirketi sistemleriyle entegrasyon.
- iOS uygulaması, Google Play yayını.
- Vatandaşa haritada canlı araç takibi göstermek (ekibin telefon konumu
  yalnız atama ve tahmini süre hesabında kullanılır, bkz. bölüm 10).

Kaçınılacaklar (teknik olarak çalışsa bile başarısızlık sayılır):
- Bir sonucun vatandaşa ulaşması için ayrı kurum ve merkez onaylarının
  beklenmesi.
- Kullanıcının hangi hesapla nereye gireceğini bulamaması.
- Ajan çalışmadığında sistemin durması.
- Ekranlarda iş yapmayan bölümler, "örnek/demo" uyarılarıyla dolu arayüz.

## 4. Roller ve uygulamalar

| Rol | Uygulama | Ana iş |
|---|---|---|
| Vatandaş | Android (KentBağ) | Bildirir, takip eder, bildirim alır, "sorun devam ediyor" der, başkasının sorununa katılır, iyileştirme isteği verir, duyuruları görür |
| Saha ekibi | Android (KentBağ Saha) | İş sırasını görür; yola çıktım / vardım / bitti; kalan süre girer; fotoğraf ekler; yapamadığı işi gerekçeyle iade eder |
| Hizmet veren kurum (su, elektrik, temizlik, fen, park) | Web | Kendi kuyruğu, ekipleri ve iş sıraları; ajan kapalıysa elle atar; ajan kararını değiştirebilir; duyuru yayınlar |
| Belediye merkezi | Web | Tüm talepler; ajanın yönlendirmeleri; ajan aç/kapat; elle yönlendirme; personel ve başvurular; raporlar |

Hesap kuralı: bir hesap tek bir personel rolüne sahiptir (merkez, kurum
yetkilisi, saha ekibi). Vatandaş hesabı ayrıca saha ekibine başvurabilir; onay
gelince aynı hesap saha uygulamasında açılır. Bu kural giriş ekranlarında açıkça
yazılır.

## 5. Talep akışı ve durumlar

Durumlar (vatandaşa gösterilen adlarıyla):

1. `received` — Alındı
2. `routed` — {Kurum}'a iletildi
3. `assigned` — {Ekip}'e atandı · sırada N. iş · tahmini varış
4. `en_route` — Ekip yolda · tahmini varış
5. `on_site` — Ekip sahada · tahmini çözüm
6. `resolved` — Çözüldü (ekip kapattı; varsa fotoğraf ve açıklama)
7. `reopened` — Sorun devam ediyor (vatandaş bildirdi) → tekrar 2'ye döner
8. `cancelled` — Vatandaş geri çekti
9. `returned` — Ekip yapamadı / kurum iade etti → ajan veya kişi yeniden atar

Kurallar:
- Ekip "bitti" dediği anda talep `resolved` olur; ek onay yoktur. Kapanış
  fotoğrafı isteğe bağlıdır; açıklama zorunludur (en az 10 karakter).
- Vatandaş `resolved` talepte "Sorun devam ediyor" der (açıklama + isteğe bağlı
  fotoğraf) → `reopened`; geçmiş korunur; aynı kuruma döner, ajan yeniden atar.
  Ayrı bir sorun için yeni talep açılır.
- Her durum değişikliği zaman damgalı bir olay kaydıdır; vatandaş zaman
  çizelgesi bu olaylardan oluşur.
- Kurum ve merkez her an ataması değiştirebilir veya talebi iptal edebilir
  (gerekçeyle).

## 6. Ana parçalar

### 6.1 Yapay zekâ ajanı

- İki karar verir: (a) talep → kurum, (b) kurum içinde → ekip.
- (a) Girdi: kategori, açıklama, adres. Çoğu talepte kategori kurumu zaten
  belirler; ajan kategori yanlış görünüyorsa düzeltme önerir ve aciliyet
  (acil/yüksek/normal/düşük) önerir. Model: Gemini (mevcut anahtar).
- (b) Ekip seçimi kural tabanlıdır, yapay zekâ gerekmez: o kurumun aktif
  ekipleri içinden en erken varış süresine sahip olan (6.2'deki hesap).
  Aciliyet sırayı etkiler: acil iş ekibin sırasında öne geçer.
- Her karar gerekçesiyle kaydedilir ve ekranda görünür ("Trafo ekibi: elindeki
  iş 40 dk sonra bitiyor, yol 15 dk").
- Ajan açma/kapama: merkez tüm sistem için, kurum kendi kuyruğu için. Kapalıyken
  talepler "atama bekliyor" kuyruğunda durur, kişi tek tıkla ajanın önerisini
  kabul eder veya başka kurum/ekip seçer.
- Gemini hata verirse veya cevap vermezse kategori eşlemesiyle devam edilir;
  sistem asla durmaz. Ajan sunucuda çalışır; istemciden gelen karar kabul
  edilmez.

### 6.2 Tahmini varış ve çözüm süresi

- Her ekibin bir iş sırası vardır (elindeki iş + sıradakiler).
- Ekip "vardım" deyince ve işi sürerken "kalan süre" girer (15 dk, 30 dk, 1 sa,
  2 sa, özel).
- Sıradaki bir işin tahmini varışı = elindeki işin kalan süresi + sıradaki
  işler için tahmini iş süreleri + iş adresleri arası yol süresi + %20 gecikme
  payı (en az 5 dk). Elinde iş yoksa yol süresi ekibin telefonundan gelen
  güncel konumdan hesaplanır (bölüm 10).
- Yol süresi: ücretsiz bir rota hizmetinden (OSRM) alınır; ulaşılamazsa düz
  çizgi mesafesi × 1,4 / 30 km/s ile tahmin edilir. Adresi haritadan
  işaretlenmemiş talepler için adres metninden konum bulunur; bulunamazsa
  "varış süresi hesaplanamadı" yazar, akış durmaz.
- Kategori başına varsayılan iş süresi (örn. elektrik 60 dk, su 90 dk, çöp
  30 dk, yol 120 dk, buzlanma 45 dk); ekip girdiği anda onun girdiği geçerli.
- Tahminler her durum değişikliğinde ve ekip kalan süreyi güncellediğinde
  yeniden hesaplanır.

### 6.3 Bildirimler

- Telefon bildirimi (Firebase Cloud Messaging): vatandaşa ve takip edenlere
  her durum değişikliğinde; saha ekibine yeni iş atandığında ve iş sırası
  değiştiğinde. Kullanıcı uygulamadan bildirimleri açar/kapatır.
- Bildirim kapalı olsa bile uygulama açılınca ve açıkken kısa aralıklarla
  güncel durumu gösterir.
- Web paneller açıkken yeni işleri kendiliğinden gösterir (kısa aralıklı
  yenileme yeterli).

### 6.4 Vatandaş uygulaması

- Ana ekran: "Sorun bildir" tek büyük düğme; altında aktif taleplerim (durum +
  tahmini süre); bölgedeki duyurular.
- Bildirim formu tek ekran: kategori, kısa açıklama, konum (GPS / haritadan
  seç / adres yaz), en fazla 3 fotoğraf. Giriş yapılmamışsa form doldurulmadan
  önce giriş istenir.
- Gönderince sunucudan talep numarası dönmeden "gönderildi" gösterilmez;
  bağlantı yoksa taslak saklanır ve tekrar denenir.
- Talep ayrıntısı: kargo takibi gibi zaman çizelgesi, harita, tahmini süreler,
  ekip kapanış fotoğrafı, "Sorun devam ediyor".
- Kategoriler (arıza): elektrik, su, çöp, yol, buzlanma. İyileştirme
  istekleri: kaldırım, aydınlatma, erişilebilirlik, park/ortak alan (bkz. 7).

### 6.5 Saha uygulaması

- Ana ekran: iş sırası. En üstte "şimdiki iş" kartı ve tek büyük düğme
  (Yola çıktım → Vardım → Bitti). Altında sıradaki işler ve tahmini başlama
  saatleri.
- Bitti: açıklama (zorunlu) + fotoğraf (isteğe bağlı) → talep kapanır.
- "Yapamıyorum": gerekçeyle iade; talep `returned` olur, ajan/kurum yeniden
  atar.
- Adresi navigasyonda aç bağlantısı.

### 6.6 Kaybolmayan bildirim

Eski sistemde kaybolan bildirimin sebebi bulunamadı. Yeni sistemde:
- Her talep tek bir tabloya yazılır; merkez listesi bu tablodan filtresiz okur
  (yönlendirilmemiş/ajan hatası alan talepler dahil).
- İstemci aynı talebi tekrar göndermeye karşı istek numarası kullanır.
- Uçtan uca otomatik test: vatandaş API'si ile talep oluştur → merkez listesinde
  görün → ajan atasın → saha listesinde görün.
- Eski sistemdeki kaybın sebebi zaman kalırsa incelenir; yeni sistemi
  bloklamaz.

## 7. Ek özellikler (ana akıştan sonra eklenir)

Kullanıcı bunların hepsini istiyor; sıralama yalnızca güvenlik içindir.

1. **Demo girişi:** Giriş ekranlarında "Demo olarak gir: Vatandaş / Merkez /
   Elektrik kurumu / Trafo ekibi …" düğmeleri ve hazır örnek veri. Demo
   girişleri yalnız demo hesaplarına açılır ve sunucu ayarıyla kapatılabilir.
2. **Ortak sorunlar ve takip:** Vatandaş yakındaki (1,5 km) aynı kategorideki
   aktif talepleri görür, "Ben de etkileniyorum" der; takip eder ve bildirim
   alır. Kurum benzer talepleri tek işte birleştirebilir; birleşen talepler aynı
   durumu ve tahmini süreleri paylaşır, kapanışta hepsi kapanır. Destek sayısı
   kişi sayısı gibi gösterilmez.
3. **İyileştirme istekleri:** Arıza olmayan istekler; ajan ilgili kuruma
   yönlendirir ama ekibe atamaz; kurum "planlandı / reddedildi (gerekçe) /
   tamamlandı" der. Başkaları destekleyebilir.
4. **Duyurular:** Kurum veya merkez bölgeye duyuru yayınlar (planlı kesinti,
   bakım). Vatandaş ana ekranında görür; duyuru bir talebe bağlanabilir.
5. **Personel yönetimi ve başvurular:** Merkez kurum ve ekip hesapları açar,
   kapatır. Vatandaş saha ekibine başvurur; ilgili kurum veya merkez onaylar.
6. **Şifre sıfırlama e-postası:** Mevcut e-posta hizmetiyle (Resend).
7. **Raporlar:** Merkez ve kurum için ortalama varış ve çözüm süresi, açık
   talepler, yeniden açılma oranı; CSV dışa aktarma.

## 8. Kısıtlar

- Süre: 6 gün, sunum canlı internet sisteminde ve gerçek telefonda yapılacak.
- Arayüz dili Türkçe. Ekranlar telefon genişliğinde de çalışır (web paneller
  dahil).
- Gizlilik: vatandaşın adı ve özel fotoğrafları kurum/ekip dışında
  görünmez; ortak sorunlarda yalnız kategori, yaklaşık konum ve durum paylaşılır.
- Gizli anahtarlar istemcilere ve git'e girmez.
- Mevcut sistem ve verisi dokunulmadan kalır (ayrı veritabanı, ayrı Vercel
  projeleri).

## 9. Kullanıcının kararları

- Android: vatandaş ve saha ekibi. Web: belediye merkezi ve kurumlar.
- Her şey bulut sunucusunda; bilgisayar açık olmadan çalışır.
- Ajan öncelikli; ajan kapatılıp elle yapılabilmeli.
- Ekip "bitti" deyince talep anında kapanır, vatandaşa bildirim gider; ekip
  kapanış fotoğrafı ekleyebilir.
- Tahmini varış ekibin iş sırasından ve konumlar arası yol süresinden
  hesaplanır, gecikme payı eklenir.
- Boştaki ekip için varsayılan/üs adresi kullanılmaz; ekibin bulunduğu
  yerden hesaplanır.
- Bildirim isteğe bağlı; durum her zaman uygulamada görünür.
- Bölüm 7'deki tüm ek özellikler istenir.
- Teknik ayrıntılar yapımcıya bırakıldı.

## 10. Yapımcının kararları (Claude)

- Yığın: TypeScript; React + Vite (web ve iki Android uygulamanın arayüzü),
  Capacitor (Android), Node/Express sunucu Vercel'de, Neon PostgreSQL, Better
  Auth (e-posta/şifre), özel Vercel Blob (fotoğraflar), Gemini, Firebase Cloud
  Messaging, Resend, harita için Leaflet + OpenStreetMap, rota için OSRM.
- Tek depo içinde yeni klasör `v2/`: `api/`, `web/` (merkez + kurum aynı
  sitede, role göre ekran), `citizen/` (Android), `crew/` (Android), `shared/`
  (tipler, durum makinesi, ETA ve ajan kuralları; hem API hem istemciler
  kullanır).
- Ayrı veritabanı: mevcut Neon projesinde yeni bir `kentbag2` veritabanı; fotoğraflar mevcut özel Blob deposunda `v2/` önekiyle. Yeni Vercel projeleri (`kentbag2-api`, `kentbag2-web`). Eski sistemle veri paylaşılmaz.
- Android paket kimlikleri: yeni kimlikler (`com.kentbag.vatandas`,
  `com.kentbag.ekip`), mevcut imza anahtarıyla (`%USERPROFILE%\.cache\
  kentyanimda-android\signing`, yedekte de var) imzalanır. Yeni uygulamalar
  eskilerin yanına kurulur; eski uygulamalar sunumda yedek olarak telefonda
  kalır. Sürüm: vatandaş 2.0.0, saha 1.0.0.
- "Sorun devam ediyor" aynı talebi yeniden açar; ayrı sorun için yeni talep.
- Ekip seçimi kural tabanlı (en erken varış); Gemini yalnız kurum/kategori ve
  aciliyet önerisinde.
- Ekip modeli: "ekip" bir birimdir (ör. Trafo ekibi); her saha personelinin
  kendi hesabı vardır ve tek bir ekibe bağlıdır. Ekibin işini ekipteki herhangi
  bir üye ilerletebilir. Ekip saha uygulamasındaki "Mesaideyiz / Mesai dışı"
  anahtarıyla aktif olur; kurum bir ekibi tamamen kapatabilir. Ajan yalnız
  aktif ekiplere atar.
- Ekibin konumu: varsayılan/üs adresi yoktur. Saha uygulaması mesai
  açıkken ekibin güncel konumunu sunucuya iletir (uygulama açıkken birkaç
  dakikada bir ve her durum değişikliğinde; konum izni istenir). Elinde iş
  olmayan ekibin yol süresi bu son konumdan hesaplanır. Konum hiç yoksa veya
  çok eskiyse (30 dk üstü) son iş adresi kullanılır; o da yoksa "varış süresi
  hesaplanamadı" yazar ve ekip yine atanabilir. Konum yalnız atama ve tahmin
  için kullanılır; vatandaşa harita üzerinde canlı ekip konumu gösterilmez.
- Ajan anahtarları: ajan bir talepte yalnız hem merkez anahtarı hem o kurumun
  anahtarı açıksa çalışır. Merkez kapatırsa her yerde kapanır.
- Demo bölgesi: Oltu (Erzurum), mevcut sistemdeki pilot bölge; demo adresleri
  ve mahalleler oradan.
- Duyuru bölgesi: Oltu mahallelerinden bir veya birkaç mahalle ya da "tüm
  ilçe".
- Kategori → kurum eşlemesi (ajanın yedeği ve demo verisinin temeli):
  elektrik ve aydınlatma → Elektrik Dağıtımı; su → Su ve Kanalizasyon; çöp →
  Temizlik İşleri; yol, kaldırım, erişilebilirlik, buzlanma → Yol ve Fen
  İşleri; park/ortak alan → Park ve Bahçeler. Ekipler mevcut sistemdekilerle
  aynı adlarla gelir: Elektrik (arıza, şebeke bakım, trafo), Su (arıza,
  kanalizasyon), Temizlik (atık toplama, bölge temizlik), Fen (yol bakım, kış
  bakım), Park (park bakım, ortak alan).

## 10a. Kullanıcıdan gereken dış işlem

- Firebase: telefon bildirimleri için kullanıcının Google hesabıyla ücretsiz
  bir Firebase projesi açılır ve iki Android uygulaması (`com.kentbag.vatandas`,
  `com.kentbag.ekip`; eski saha uygulaması `com.kentbag.saha` kullandığı için) kaydedilir. Yapımcı adımları Gün 3'te verir; gecikirse
  bildirimler Gün 4'e kayar, uygulama içi durum gösterimi etkilenmez.
- Yeni veritabanı ve Vercel projeleri kullanıcının mevcut hesaplarında açılır;
  Vercel CLI girişi bu bilgisayarda yapıldı.

## 11. Yapımcıya bırakılanlar

Veritabanı şeması, API biçimi, klasör içi düzen, test araçları, görsel tasarım
dili, yenileme aralıkları, demo veri içeriği, kategori başına varsayılan iş
süreleri, ekran yerleşimleri (bölüm 6'daki ana ekran tariflerine uyarak).

## 12. Teslim sırası (güvenlik için)

1. Gün 1–2: `shared` kurallar + API + veritabanı + ajan + merkez/kurum web;
   uçtan uca API testi.
2. Gün 3: vatandaş ve saha Android uygulamaları, ana akış telefonda.
3. Gün 4: bildirimler, ETA, haritalar, demo girişi; bulutta canlı yayın.
4. Gün 5: ek özellikler (ortak sorun/takip, iyileştirme, duyurular, personel,
   şifre sıfırlama, raporlar).
5. Gün 6: canlıda tam prova, hata düzeltme, sunum senaryosu belgesi.

Her günün sonunda o güne kadar yapılanlar canlıda çalışır durumda tutulur.
