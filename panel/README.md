# KentBağ · Belediye paneli

Oltu yerel pilotunda gerçek vatandaş talepleriyle çalışan merkez birim ekranı. Kurulum ve telefon bağlantısı için [yerel deneme kılavuzu](../YEREL_DENEME.md).

```powershell
npm ci
npm run dev
```

Bilgisayarda `http://localhost:4280/` açılır. `/api` istekleri yerel API'ye (`127.0.0.1:3000`) aktarılır. API `sunucu` klasöründen `npm run pilot` ile başlatılır. Yerel yönetici bağlantısı sadece loopback istemcisine ve izin verilen panel kaynağına açılır; panel anahtarı APK'ya, derlenmiş web paketine veya Git'e yazılmaz. Çok kullanıcılı üretim kimlik doğrulaması henüz yoktur.

Varsayılan ekran gerçek pilot verilerini kullanır. Sunucu yoksa hata görünür; kendiliğinden örnek verilerle dolmaz. **Örnek alanı aç** veya `/?ornek=1` ile tamamen ayrı, tarayıcıda saklanan örnek çalışma açılır. **Yerel sisteme bağlan** gerçek kuyruğa döner. Gerçek kayıtlar örnek sıfırlamayla silinemez.

## Yapılabilenler

- Gelen arıza ve iyileştirme taleplerini, fotoğraf ve elle/GPS/haritayla girilen konumlarını inceleme; koordinatsız adres için nokta uydurulmaz.
- Gerekçeli kural/Gemini aciliyet önerisiyle kuyruk sıralama; yetkilinin ayrı öncelik kararı. Anahtar yokluğu ve analiz hatası görünürdür.
- Kategoriye uygun birim/ekip atama, çalışmayı başlatma, çözüm kaydetme, yeniden inceleme. Saha uygulaması teslimi henüz yoktur.
- Vatandaşa açık açıklama/durum/çözümü gerçek kaydına ve uygulama içi güncellemelerine yazma. Kurum içi notlar vatandaş yanıtına dahil edilmez.
- Vatandaşın çözüm geri dönüşünü ve sorunun sürdüğüne dair açıklamasını görme. Çözüm bildirimi vatandaş onayı değildir; devam eden sorun çözülmüş sayılmaz.
- Dış kurum kuyruğu oluşturma; su için ESKİ, elektrik için dağıtım kurumu. Gerçek dış kurum gönderimi veya teslim teyidi yoktur.
- Sunucuda kalıcı ekip durumları, duyurular, çalışma kayıtları ve işlem geçmişi; kategori/ekip uygunluğu sunucuda da doğrulanır.
- Türkçe arama, durum/kategori/öncelik filtreleri, liste/harita ve canlı/örnek ayrımı işaretlenen CSV.

Duyurular ve çalışma sonuçlarının vatandaşın genel bölge yayınına aktarımı henüz bağlı değildir; bu aşamada panel kayıtlarıdır. Mobildeki mahalle örnekleri gerçek duyurularla karıştırılmaz. Arka planda push/e-posta, gerçek saha görevi teslimi ve sonuç fotoğrafı üçüncü blokla tamamlanacaktır.

## Doğrulama

```powershell
npm run typecheck
npm test
npm run build
npm run test:ui
```

UI testleri `?ornek=1` çalışma alanını kullanır; gerçek veritabanını değiştirmez. Yerel sunucu entegrasyon testleri `sunucu/tests/municipality.test.ts` içindedir. Güncel tarayıcı doğrulamasında ayrı test veritabanıyla talep → birim/aciliyet → atama → açıklama/çözüm → vatandaş geri dönüşü denendi.

`src/domain.ts`, API'nin de kullandığı saf işlem kurallarını `sunucu/src/municipality-domain.ts` dosyasından dışa aktarır. `fixtures.ts` yalnız örnekler, `store.tsx` birbirinden ayrı API/örnek katmanlarıdır. Fotoğraf sunucusu, kurum işlemleri ve role göre erişim pilot API tarafından sağlanır; üretim için Vercel dağıtımı ve kurumsal rol sistemi ayrıca tamamlanacaktır.
