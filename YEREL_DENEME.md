# Oltu yerel pilotu · 1.3.0

## Kullanım

1. Bilgisayar ve Android telefon aynı Wi-Fi ağında olsun.
2. `sunucu` klasöründe `npm ci` ve `npm run pilot` çalıştır. Pilot; gerçek Better Auth hesapları, imzalı oturumlar ve PostgreSQL uyumlu dosya tabanlı PGlite kullanır. Docker, Supabase veya Vercel hesabı istemez.
3. `panel` klasöründe `npm ci`, `npm run dev` çalıştır. Bilgisayarda `http://localhost:4280/` aç. Yerel yönetici bağlantısı yalnız bu bilgisayardan açılabilir; vatandaş hesabı panel yetkisi vermez. Bu, üretim için çok kullanıcılı belediye kimlik doğrulaması değildir.
4. `mobil` klasöründe `npm run phone` ile indirme sayfasını aç. Güncel derleme `artifacts/KentYanimda-Android-1.3.0.apk`. İndirme sayfasının gösterdiği QR'ı okut ve mevcut uygulamayı güncelle. Mevcut test imzası ve paket kimliği korunur.
5. Uygulamada hesabını oluştur, bir talep gönder. Belediye paneli görünürken yaklaşık üç saniyede yenilenir. Panelde vatandaş açıklaması, ekip ataması veya çözüm kaydet. Telefon açıkken yaklaşık 15 saniyede, uygulamaya geri dönünce de yenileme yapılır. Bunlar uygulama içi güncellemelerdir; arka planda push bildirimi henüz yoktur.

Bu bilgisayarda hazırlanan APK'nın API adresi `http://10.180.23.5:3000`; indirme sayfası `http://10.180.23.5:8181`. Wi-Fi/IP değişirse aşağıdaki komutla APK'yı yeniden oluştur. Menülerin açılması bilgisayara bağlı değildir; yerel veriye ulaşmak bağlıdır. Android cihazdan son ağ/kamera denemesi kullanıcı tarafından yapılmalıdır.

## APK'yı yerel API'ye bağlayarak oluşturma

```powershell
# mobil klasöründe, bilgisayarın o anki özel IPv4 adresiyle:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -LanHost 10.180.23.5
npm run phone
```

LAN derlemesi yalnız verilen özel IP'ye HTTP istisnası ekler. Genel HTTP izni verilmez. Derleme sonrası kaynak ağ kuralı tekrar HTTPS gerektiren varsayılana döner. Normal `npm run android:apk` LAN istisnası açmaz; üretim API'si için derleme ortamında `VITE_PRODUCTION_API_URL=https://...` kullanılır. APK arayüzü dışarıdan yüklemez.

Web önizlemesi için mobilde Git'e girmeyen `.env.local` içine `VITE_API_URL=http://IP:3000` ve `VITE_LAN_PILOT=true` yazılır. Vite'ı yeniden başlat. Gerçek GPS konumu Oltu diye değiştirilmez; yalnız başlangıç haritası ve proje etiketi Oltu'dur.

## Gemini

`sunucu/.env`:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
KENT_LAN_HOST=10.180.23.5
```

Anahtar edinince yalnız `GEMINI_API_KEY` satırını doldur ve `npm run pilot` sürecini yeniden başlat. Anahtar sohbet, mobil paket veya panel ortamına yazılmaz. Henüz değerlendirilmemiş kayıtlar arka plandaki kuyruktan alınır. Talep makbuzu model beklenmeden saklanır; Gemini hatasında kural tabanlı öneri korunur. Hatalı analizler otomatik ücretli tekrar döngüsüne girmez; sonraki talepler yeniden denenir.

Model girdisi kategori, tür ve açıklamadır; hesap kimliği, profil, koordinat ve fotoğraflar eklenmez. Açıklamadaki yaygın telefon/e-posta/kimlik numarası kalıpları maskelenir; bu, serbest metindeki bütün kişisel bilgileri tanıdığı iddiası değildir. Küfür, duygu yoğunluğu veya destek sayısı aciliyet kuralı değildir. Erişilebilirlik ve kritik hizmet etkisi dikkate alınır. Gemini kuralın gördüğü güvenlik riskini düşüremez. Yetkilinin elle belirlediği önceliği değiştirmez. Görsel uygunluk analizi bu değişikliğe dahil değildir.

## Yönlendirme

- Yol, buzlanma, kaldırım, erişilebilirlik ve aydınlatma isteği: Fen İşleri ve İmar kuyruğu.
- Çöp: Temizlik İşleri kuyruğu.
- Park: ortak alan koordinasyonu kuyruğu.
- Su: ESKİ dış kurum kuyruğu. Elektrik: elektrik dağıtım kurumu dış kurum kuyruğu.

Bunlar proje içindeki pilot yönlendirme kurallarıdır; Oltu Belediyesi veya dış kurumlarla yapılmış bir entegrasyon anlaşması anlamına gelmez. Dış kuruma gönderim/teslim teyidi yoktur; panel ve vatandaş metni bunu açıkça belirtir. Saha uygulaması bağlı değildir; ekip atamaları panel kayıtlarıdır. Duyurular ve çalışma kayıtları sunucuda saklanır ancak vatandaşın bölge yayınına henüz aktarılmaz.

## Veri ve sınırlar

`sunucu/.local/` altında veritabanı, özel fotoğraflar ve otomatik oluşturulan sunucu sırları saklanır. `.env`, `.local`, APK ve derleme çıktıları Git'e gönderilmez. Bu klasörü silmek gerçek pilot verilerini kaybettirir. Yedeklemek için API'yi kapattıktan sonra klasörün tamamını güvenli bir yere kopyala. Üretimde mevcut PostgreSQL/özel Blob altyapısı kullanılacak; bu pilotu doğrudan internete açma.

Panelde **Örnek alanı aç** seçimi ayrı tarayıcı verisi kullanır. Gerçek taleplerle birleştirilmez. **Yerel sisteme bağlan** gerçek kuyruğa döner. Örnek sıfırlama gerçek veritabanını etkileyemez.

Doğrulama: API testlerinde gerçek diskteki auth/veri/fotoğraf akışı, yeniden başlatma, idempotent gönderim, özel notların vatandaştan gizlenmesi, rol ayrımı ve dış kurum teyidi sınandı. Model şeması ve hata dönüşü sahte sağlayıcı yanıtıyla test edildi. 21 Ekim 2026 tarihinde gerçek Gemini bağlantısı da doğrulandı: uygulamanın analiz fonksiyonu `source=gemini`, `aiState=done` döndürdü. İlk gerçek yanıtlar yaklaşık 37–39 saniye sürdü; analiz arka planda 60 saniyelik sınırla çalışır ve talep makbuzunu bekletmez. Anahtar yalnız sunucunun Git dışında tutulan `.env` dosyasındadır. Tarayıcıda ayrı test veritabanıyla vatandaş → panel → açıklama/çözüm → vatandaş geri dönüşü denendi. Android APK imzası, gömülü arayüz ve sürüm denetlendi; kullanıcı telefondan sağlık adresine erişimi doğruladı. Yeni sürümün fiziksel cihaz denemesi ayrıca yapılmalıdır.

Kaynaklar: [Oltu mahalleleri](https://oltu.bel.tr/icerik/mahalle-muhtarlarimiz), [Oltu birimleri](https://oltu.bel.tr/profil-kategori/birim-mudurleri), [ESKİ ilçe altyapısı](https://www.eski.gov.tr/ilcelerde-altyapi-seferberligi-devam-ediyor), [PGlite socket](https://pglite.dev/docs/pglite-socket), [AI SDK Google](https://ai-sdk.dev/providers/ai-sdk-providers/google), [Gemini modelleri](https://ai.google.dev/gemini-api/docs/models).
