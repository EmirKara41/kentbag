# KentBağ internet demosu

Merkez ve kurum girişi: https://kentbag-panel-emir-kara-s-projects.vercel.app/giris

API: https://kentbag-api-emir-kara-s-projects.vercel.app/api/health

4 Kasım 2026 itibarıyla Vercel üzerinde API ve panel, ücretsiz Neon PostgreSQL, özel Vercel Blob fotoğraf deposu ve ücretsiz Resend e-posta hizmeti bağlıdır. Bu, ders projesi demosudur; gerçek belediye/dağıtım kurumu entegrasyonu değildir. Mevcut lollore.com sitesi taşınmadı; yalnız e-posta gönderimi için üç ek DNS kaydı oluşturuldu.

## Hesaplar

Bir merkez ve beş ayrı kurum hesabı oluşturuldu. Kullanıcı bilgileri ve rastgele şifreler yalnız `sunucu/.local/KENTBAG_DEMO_HESAPLARI.md` dosyasında bulunur; Git'e veya sunum slaytlarına eklenmez. Merkezde **Personel hesapları** bölümünden yeni kurum/merkez hesabı oluşturulabilir, mevcut erişim kapatılabilir. Vatandaş kaydı personel yetkisi sağlamaz. İnternet yayınında yerel yönetici oturumu açma uçları kapalıdır.

## E-posta akışı

Talep ayrıntısında **Kurum paneli + demo e-posta** seçilince kurum kuyruğu ve kalıcı gönderim kaydı aynı veritabanı işleminde oluşur. Her demo kurum için test alıcısı **emirkara@lollore.com**, gönderen **bildirim@lollore.com** adresidir. Mesaj, hedef kurumu ve merkez açıklamasını belirtir. Kurumun panel kullanmadan e-posta kopyasını alması mümkündür; e-postaya verilen cevap otomatik olarak sisteme aktarılmaz.

Panel e-posta durumunu ve gönderilen metni gösterir. Sağlayıcının kabulü, kurumun okuduğu veya işlemi başlattığı anlamına gelmez. Başarısız gönderimde kurum kaydı korunur; sınırlı tekrar gönderim aynı sağlayıcı idempotency anahtarıyla yapılır. Gerçek kullanımda kurum başına adres ve iletişim tercihi ayrıca tanımlanmalıdır; demo alıcısı tek sunucu ayarıdır.

## Doğrulananlar ve kalanlar

- 18 sunucu testi, 8 panel testi ve panel üretim derlemesi geçti.
- İnternet sunucusunda demo vatandaş kaydı → merkez → Fen İşleri → e-posta kopyası → kurumsal yanıt → vatandaş akışı doğrulandı. Demo talep: **KY-E88CBA33**. Bu kaydın Gemini analizi `source=gemini`, `aiState=done` döndürdü.
- Alan adı doğrulandı; bağlantı testi ve kurum yönlendirme e-postası için sağlayıcı `delivered` bildirdi. Bu, alıcının okuduğu anlamına gelmez.
- Önceki yerel pilot verileri bilgisayarda korundu; bulut demosuna aktarılmadı.
- Mevcut Android 1.3.2 hâlâ eski yerel API adresini kullanır. Buluta bağlı yeni APK henüz hazırlanmadı.
- Saha uygulaması, fotoğraflı ekip sonucu ve kurum onayı bir sonraki aşamadır. Saha hesabı oluşturma seçeneği arayüzde bu aşamaya kadar kapalıdır.

## Yeniden yayınlama

API: `sunucu` içinde `npm run typecheck`, `npm test`; sonra `npx vercel deploy --prod --skip-domain`. Sağlık ve yetki denetiminden sonra test edilen dağıtımı `vercel promote` ile yayınla. JavaScript giriş dosyası `app.js`, `build:cloud` ile oluşturulan `dist/server.js` dosyasını kullanır; `.vercelignore` yerel veritabanı, sırlar, testler ve betikleri dağıtımdan çıkarır.

Panel: `panel` içinde `npm test`, `npm run build`, `node scripts/prepare-cloud.mjs`, `npx vercel deploy --prebuilt --prod --skip-domain`. Test edilen dağıtımı `vercel promote` ile yayınla. Build Output API, Windows'taki yerel builder symlink gereksinimini kullanmadan doğrulanan Vite dosyalarını paketler.

`.env*`, `.local/` ve `.vercel/` dosyalarını paylaşma. `configure-cloud.mjs` mevcut projeye özel kurulum betiğidir; sırları terminale yazdırmadan Vercel'e aktarır. `bootstrap-staff.ts` ilk demo hesaplarını oluşturur. `verify-cloud.mjs` açıkça etiketli demo kaydı oluşturup yapılandırılmış test alıcısına e-posta gönderir; birim testi değildir.
