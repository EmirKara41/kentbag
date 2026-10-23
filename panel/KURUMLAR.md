# Kurum çalışma alanları · Panel 0.3.0

Beş kurum rolü aynı arayüz ve sunucu üzerinden ayrı kuyruklarla çalışır:

| Alan | Adres | Kurum kimliği |
| --- | --- | --- |
| Yol ve Fen İşleri | /kurumlar/yol-isleri | public-works |
| Elektrik Dağıtımı | /kurumlar/elektrik | electricity-external |
| Su ve Kanalizasyon | /kurumlar/su | water |
| Temizlik İşleri | /kurumlar/temizlik | cleaning |
| Park ve Ortak Alanlar | /kurumlar/parklar | parks |

Kurum listesi `/kurumlar` adresindedir. Merkez panelinde **Kurum çalışma alanları** menüsü gerçek teslim ve inceleme sayılarını gösterir. Standart birim ataması kurum teslimi sayılmaz. Talep ayrıntısında **Kurum çalışma alanına gönder** bölümünden kategoriye uygun hedef seçilip notla gönderilir. Aynı etkin teslim tekrar gönderilerek kopyalanamaz; iade edilmiş talep yeniden gönderilebilir.

Kurum yalnız kendisine gönderilen talepleri, konum ve fotoğraflarını, merkez notunu ve kendi işlem geçmişini görür. Merkezin özel iç notları, kişi profili ve diğer kurumların talepleri gönderilmez. **İncelemeye al** kurumun kaydı gördüğünü merkeze yansıtır. **Kurum ve merkez arasında not** vatandaşa açılmaz. Talep sahibine yanıt veya paylaşılan kayıtta katılan herkese açıklama ayrıca seçilir. Kurumun yazdığı açıklamalar vatandaşın mevcut uygulamasında görünür; yeni APK gerekmez.

Görev emrinde kurumun pilot ekiplerinden biri, iş talimatı ve görev önceliği seçilir. Aynı talepte tek etkin hazırlık emri tutulur; değiştirmek için gerekçeyle iptal edilip yenisi hazırlanır. Kurum talebi gerekçeyle merkeze iade edebilir; bu durumda hazır görev iptal edilir. Vatandaşın geri çektiği veya merkezin sonuçlandırdığı talepte de hazır emir iptal edilir. Kayıtlar PostgreSQL uyumlu yerel veritabanında kalır; sayfa yenileme veya sunucu yeniden başlatma ile kaybolmaz.

## Saha bağlantısına bırakılan sözleşme

`institution_work_order` kaydı: id, report_id, delivery_id, unit_id, team_id, instruction, priority, state, created_at, updated_at. Şimdilik durumlar `prepared` ve `cancelled`. Bu bir görev hazırlığıdır; cihaz teslimi, çalışan kabulü veya çalışma başladı iddiası taşımaz. Saha modülü eklendiğinde kurum ve ekip hesabı eşleştirmesi, teslim/kabul, çalışma aşamaları ve fotoğraflı sonuç eklenmelidir. Saha tüketicisi görevi teslim etmeden önce güncel talebin hâlâ işlem yapılabilir olduğunu ve kurum tesliminin geçerliliğini doğrulamalıdır.

## Yetki ve pilot sınırı

Kurum oturumu yalnız bu bilgisayardan, izin verilen localhost panel kaynağıyla açılır. Sunucu tek kuruma bağlı, sekiz saatlik imzalı bir yetki üretir; tarayıcıda yalnız bellekte tutulur. Başka kurumun adresini yazmak bu yetkiyi genişletmez; kurum yetkisi merkez API'sini kullanamaz. Bu, gerçek kurum personelinin internetten giriş yaptığı üretim kimlik doğrulaması değildir. Gerçek kullanım öncesi personel hesapları ve kurum üyelikleri gerekir. Kurum/ekip isimleri pilot rollerdir; dış kurumların gerçek sistemlerine gönderim yapılmaz.

API: merkez için `POST /api/municipality/institutions/forward`; kurum için `POST /api/institutions/:unitId/local-session`, `GET /workspace`, `POST /actions`. Kurum eylemleri: accept, return, note, message, order, cancel-order. Merkez, teslim durumu ve kurum geçmişini kendi talep ayrıntısında görür. Tam sistem saha testleri saha modülü tamamlandıktan sonra yapılacaktır; bu aşamada kurumlar arası erişim, kalıcılık ve merkez → kurum → hazırlık akışı doğrulanmıştır.
