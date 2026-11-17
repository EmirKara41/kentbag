# KentBağ v2 — Faz 2 planı (18 Kasım 2026)

Dönüş noktası: git etiketi `faz1-tamam` (b666892) ve `C:\Users\emirk\KentBag-Yedek-Faz1-2026-11-18`.
Kaynak: tasarım belgesi bölüm 7. Demo girişi Faz 1'de yapıldı.

## İlkeler
- Veritabanı değişiklikleri yalnızca ekleme yapar (`002_faz2.sql`): yeni tablolar, yeni sütunlar. Faz 1 kodu yeni şemayla da çalışır.
- Şema, API soğuk başlangıçta advisory lock altında kendiliğinden kurulur; yayın için yerelde veritabanı şifresi gerekmez.
- Her özellik: önce API testi, sonra arayüz. Faz 1 testleri yeşil kalır.

## Özellikler ve kararlar
1. **İyileştirme istekleri** — `kind = improvement`. Yeni durumlar `planned` (Planlandı) ve `rejected` (Uygulanmayacak).
   Eylemler: `plan` (routed → planned), `reject` (routed/planned → rejected, gerekçeli), `complete` (routed/planned → resolved).
   Yetki: ilgili kurum ya da merkez. Ajan yönlendirir, ekibe atamaz; `assign` iyileştirmede yasak.
   Vatandaşın rota şeridi: Alındı → Kuruma iletildi → Planlandı → Tamamlandı.
2. **Ortak sorunlar ve takip** — `request_supporter (request_id, user_id)`.
   - `GET /api/requests/nearby` aynı kategorideki, 1,5 km içindeki aktif talepleri döner (açıklama ve fotoğraf olmadan).
   - `POST/DELETE /api/requests/:id/support`: "Ben de etkileniyorum" ve takibi bırak. Takip edilen talep vatandaşın listesinde görünür. Bildirimler destekçilere de gider.
   - Birleştirme: `merge` eylemi talebi `merged` yapar ve `merged_into` alanını doldurur. Talep sıradan çıkar, sahibi ana talebin destekçisi olur. Vatandaş görünümü ana talebin durumunu, tahminlerini ve kapanışını gösterir. Ana talep çözülünce birleşen talep de çözülmüş görünür. Sorun sürüyorsa sahibi yeniden açabilir; bu durumda talep ayrılır ve tekrar işleme girer.
   - Destek sayısı yalnız personelde görünür. Vatandaş "başkaları da bildirdi" ifadesini görür.
3. **Duyurular** — `announcement` tablosu. Merkez her yere, kurum kendi adına duyuru yayınlar. Alanlar: mahalle (boş = tüm ilçe), bitiş zamanı, isteğe bağlı bağlı talep. Vatandaş ana ekranda görür; push açıksa bildirim de gider.
4. **Personel yönetimi ve başvurular**
   - Merkez herhangi bir personel hesabı açar ya da kapatır. Kurum yalnız kendi ekip hesaplarını açar ve kapatır. Var olan vatandaş hesabına rol verilebilir.
   - `crew_application`: Vatandaş uygulamasından ekibe başvurulur. Kurum (ya da merkez) onaylar veya reddeder; onaylanınca hesap ekip rolü alır.
5. **Şifre sıfırlama** — Better Auth `sendResetPassword` + Resend (`RESEND_API_KEY`, `RESEND_FROM`). Bağlantı web'deki `/sifre` sayfasına gider. Üç girişte de "Şifremi unuttum" var.
6. **Raporlar** — `GET /api/staff/reports` ve `/api/staff/reports.csv`. İçerik: durum dağılımı, açık talepler, ortalama varış ve çözüm süresi, yeniden açılma oranı, kurum ve kategori kırılımı. Kurum yalnız kendini görür.

## Arayüz
- Web üst menüsü: Talepler · Duyurular · Personel · Raporlar. Kurumun "Talepler" sayfasına İyileştirme önerileri bölümü eklenir.
- Vatandaş: Bildir ekranında Arıza/İyileştirme seçimi ve yakındaki aynı sorunlar. Ana ekranda duyurular ve takip ettiklerim. Ayarlarda "Saha ekibine başvur". Girişte "Şifremi unuttum".
- Ekip: Girişte "Şifremi unuttum".

## Sıra
iyileştirme → ortak sorunlar ve birleştirme → duyurular → personel ve başvurular → şifre sıfırlama → raporlar → inceleme → yayın (API, web, iki APK).
