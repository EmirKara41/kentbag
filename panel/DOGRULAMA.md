# Belediye paneli · Doğrulama

18 Ekim 2026 · 0.1.0 · İkinci blok, bağımsız yerel örnek çalışma alanı.

| Kontrol | Sonuç |
| --- | --- |
| TypeScript | Geçti |
| İş akışı kuralları | 7/7 test geçti |
| Tarayıcı iş akışları | 5/5 test geçti |
| 390 / 768 / 1440 px gezinme ve ayrıntı | Sayfa taşması yok; ayrıntı penceresi ekrana sığıyor |
| Üretim paketi | Başarıyla oluşturuldu; harita ayrı parça |
| Yerel önizleme | localhost:4280, HTTP 200 |
| Gerçek API / kurum oturumu / ekip bağlantısı | Bu aşamada bağlanmadı |
| İnternet yayını | Yapılmadı |

İş kuralı testleri: birim/kategori/ekip uygunluğu ve kapalı ekip; atama öncesi çalışma başlatamama; dış kuruma teslim teyidi uydurmama; geri çekilen ve sorunu süren kayıtların çözüm sayısını şişirmemesi; yeniden incelemede geçmiş çözümün korunması; kurum içi ve vatandaşa açık açıklamaların ayrılması; duyuru ilişkilerinin tutarlılığı; çalışmanın talepleri kendiliğinden kapatmaması; CSV'de formül ve çift tırnak kaçışları.

Tarayıcı senaryoları:

1. Talep arama, birim/ekip atama, kurum içi not ve vatandaşa açık açıklama ekleme; vatandaş önizlemesinde özel notun bulunmaması; yenilemede atama ve geçmişin korunması.
2. Duyuru açıklaması/tahmini bitişini güncelleme, vatandaş önizlemesi, ilişkili iki talebin korunması ve sayfa yenilemesinde yayının bulunması.
3. İki harita kaynağı da kapalıyken talep listesinin çalışması ve elle adresli kaydın harita noktası olmadan açılması.
4. Tamamlanan çalışma oluşturma ve talebe bağlama; ilgili talebin durumunun kendiliğinden değişmemesi; CSV indirme.
5. Tüm ana ekranlarda 390/768/1440 px gezinme, yatay sayfa taşmasının bulunmaması ve ayrıntı penceresinin ekrana sığması.

Ekran görüntüleri: `artifacts/genel-bakis.png`, `talep-detayi.png`, `bolge-duyurulari.png`, `calisma-sonuclari.png`. Tümü örnektir, gerçek vatandaş veya belediye kaydı değildir. Görüntüler ve test çıktıları Git'e eklenmez.

İlk tarayıcı koşusunda aynı adlı iki “İşlem geçmişi” düğmesi nedeniyle test seçicisi belirsizdi; seçici ayrıntı penceresine sınırlandı ve son tam koşu geçti. İşletim akışında açık bir engel kalmadı.
