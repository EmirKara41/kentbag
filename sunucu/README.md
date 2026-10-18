# KentYanımda · Vercel API

Express 5 / Node.js 24. Kalıcı veriler PostgreSQL, özel fotoğraflar Vercel Blob, e-posta/şifre ve oturumlar Better Auth ile yönetilir. Supabase bağlantısı gerekmez.

## Kurulum

1. Vercel hesabını bağla ve bu klasörü (`sunucu`) proje kökü olarak seç. Framework Express, Node.js 24 kullanılır. Kaynağı Vercel CLI ile de yükleyebilirsin; herkese açık Git deposu gerekmez.
2. Vercel Marketplace'ten Neon PostgreSQL veritabanını bu projeye bağla. Havuzlu bağlantı adresini `DATABASE_URL` olarak ayarla.
3. Vercel Storage'da **Private** Blob deposu oluşturup projeye bağla. `BLOB_READ_WRITE_TOKEN` sunucu değişkenidir. Public depo kullanma.
4. `.env.example` içindeki değişkenleri Vercel'e ekle. `BETTER_AUTH_URL` sabit üretim adresi, `BETTER_AUTH_SECRET` en az 32 karakter rastgele sır olmalıdır. Önizleme dağıtımının değişken URL'sini mobil uygulamaya yazma.
5. Yerelde `npm ci` çalıştır. Aynı değişkenleri `.env` dosyasına al; `npm run migrate` ile Better Auth ve vatandaş tablolarını oluştur. Komut mevcut tabloları korur, kaldırma işlemi yapmaz.
6. Vercel'e dağıt. `GET /api/health` yanıtının `ok: true` olduğunu kontrol et. Mobil `.env` dosyasına bu sunucunun HTTPS ana adresini ekleyip bağlı APK'yı oluştur.

Hesap bağlantısı yapılmadan bu adımlar canlıya uygulanmış sayılmaz. Otomatik olarak ücretli plan veya kaynak satın alınmaz. Bölgeyi veritabanıyla aynı seçmek gecikmeyi azaltır. İlk sürümde belediye merkezi bağlantısı `false` kalır.

```powershell
npm ci
Copy-Item .env.example .env
# .env alanlarını doldur; sırları sohbete veya mobil uygulamaya koyma.
npm run migrate
npm run dev
```

Yerel API yalnızca localhost:3000 üzerinde dinler. Fiziksel telefon için HTTPS Vercel adresi kullanılır. `WEB_ORIGINS` yalnızca açıkça izin verilen web adreslerini içerir. Android uygulaması `https://localhost` WebView kaynağını ve Better Auth'un imzalı bearer oturumunu kullanır; oturum anahtarı Android Keystore ile şifrelenir. İmzasız oturum anahtarı kabul edilmez. Yeni uygulamanın konumu `../mobil/` klasörüdür.

## Davranış ve sınırlar

Tüm vatandaş işlemleri sunucuda doğrulanmış oturumdan kullanıcı kimliğini alır. İstemciden gönderilen sahiplik/durum alanlarına güvenilmez. Veritabanı ve Blob anahtarları mobil pakete girmez. Her sorgu sahipliği sınırlar; PostgreSQL doğrudan istemciye açılmaz.

Talep, fotoğraf ilişkileri, ilk olay ve ilk güncelleme aynı veritabanı işlemiyle kaydedilir. Aynı `requestId` ve içerik aynı talebi döndürür; farklı içerik 409 verir. Başka hesaba ait veya başka talepte kullanılan fotoğraf reddedilir. Tüm işlem geri alınır.

Talep `kind` alanıyla arıza (`issue`) veya iyileştirme (`improvement`) olarak doğrulanır; kategori ile tür uyuşmalıdır. Eski arıza istemcilerinde eksik tür `issue` kabul edilir. İsteğe bağlı etki etiketleri kayda eklenir; otomatik öncelik veya kurum kararı oluşturmaz.

Mobil 1.1.1'de etki seçimi formdan kaldırıldı; eski kayıt/istemci uyumluluğu korunur. Talebin konumu GPS/harita koordinatları veya `{ source: "manual", address: "..." }` olabilir. Elle adres 10–500 karakter olmalıdır ve koordinat alanları içeremez; koordinat türetilmez. Profil konumu önceki GPS/harita sözleşmesinde kalır.

`POST /api/reports/:id/feedback` yalnız kayıt sahibinin, `resolved` / `closed` talebe `solved` / `persists` geri dönüşü ve isteğe bağlı açıklama eklemesine izin verir. Resmi durum ve ekip ataması değişmez. Son cevap ve en fazla 50 geri dönüşlük geçmiş korunur; aynı cevabın tekrar gönderimi geçmişi çoğaltmaz. Mahalle yayını/destek servisi henüz yoktur; mobildeki örnek kayıtlar bu API'ye gönderilmez.

JPEG/PNG dosya imzası ve boyutları kontrol edilir; bir fotoğraf en fazla 3 MB, talep en fazla üç fotoğraf kabul eder. Bu kontrol görselin soruna uygunluğunu değerlendiren AI değildir. Gemini henüz bağlı değildir. Hesap başına günlük 30 yükleme ve 50 talep sınırı vardır. Kimlik doğrulama denemeleri veritabanı üzerinden sınırlandırılır. Vercel'in güvenilir IP başlığı kullanılır.

Fotoğraflar özel Blob deposundadır. Yalnızca sahibinin kayıtlarından üretilen 30 dakikalık imzalı URL ile API üzerinden görüntülenir. Süresi dolan bağlantıyı yenilemek için kayıtları yenile. `npm run cleanup`, bir günden eski ve hiçbir talebe bağlanmamış en fazla 100 yüklemeyi temizler; gerektiğinde tekrarlanır. Otomatik zamanlama kurulmamıştır.

E-posta doğrulaması, şifre sıfırlama e-postası, push, merkez/ekip yetkileri ve ekranları bu blokta etkin değildir. Gerçek sahaya açılmadan önce e-posta teslimi ve hesap kurtarma tamamlanmalıdır.

## Kontroller

```powershell
npm run typecheck
npm test
```

Testler gerçek Better Auth oturum akışını test belleği adaptörüyle, vatandaş SQL işlemlerini PGlite PostgreSQL ile çalıştırır. Blob yerine test deposu kullanılır. Canlı Neon/Vercel Blob bağlantısının doğrulandığı anlamına gelmez.

Kaynaklar: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Marketplace PostgreSQL](https://vercel.com/docs/marketplace-storage), [özel Blob](https://vercel.com/docs/vercel-blob/private-storage), [Better Auth](https://better-auth.com/docs/installation).
