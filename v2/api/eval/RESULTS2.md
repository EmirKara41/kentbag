# Fotoğraf kontrolü ölçümü · set 2

Model: `gemini-3.5-flash-lite` · 15 durum · 2026-11-18 06:17 UTC

| Ölçü | Değer |
|---|---|
| Tam doğruluk (3 sınıf) | 87% (13/15) |
| "Alakasız" kesinlik | 100% |
| "Alakasız" duyarlılık | 100% |
| Gerçek sorunların geçme oranı | 100% |
| Yanlışlıkla bekletilen gerçek sorun | 0 |
| Yanıt süresi (medyan / ort. / en çok) | 2387 / 2809 / 5713 ms |
| Hata / zaman aşımı | 0 |

Karşılaştırma noktası: YZ kontrolü yokken alakasız fotoğrafların %0'ı yakalanır.

## Karışıklık matrisi (satır: beklenen, sütun: model)

| | ok | doubtful | unrelated |
|---|---|---|---|
| **ok** | 9 | 0 | 0 |
| **doubtful** | 2 | 0 | 0 |
| **unrelated** | 0 | 0 | 4 |

## Durumlar

| Durum | Grup | Kategori | Beklenen | Sonuç | ms | Modelin notu |
|---|---|---|---|---|---|---|
| ✓ ice-1 | gerçek sorun | ice | ok | ok | 5713 | Fotoğrafta bildirilen buzlanma ve kar birikintisi görülmektedir. |
| ✓ water-2 | gerçek sorun | water | ok | ok | 2387 | Fotoğrafta sokaktan yukarı fışkıran su açıkça görülmektedir. |
| ✓ road-5 | gerçek sorun | road | ok | ok | 3215 | Fotoğraf yol kenarındaki çökme ve asfalt kırılmasını açıkça göstermektedir. |
| ✓ waste-4 | gerçek sorun | waste | ok | ok | 2310 | Fotoğrafta boş arazide bırakılmış siyah çöp poşeti görülmektedir. |
| ✓ waste-5 | gerçek sorun | waste | ok | ok | 2266 | Fotoğrafta ormanlık alana atılmış eski eşya ve çöpler açıkça görülmektedir. |
| ✓ river-1 | alakasız | water | unrelated | unrelated | 2231 | Fotoğrafta su kesintisiyle ilgili bir tesis veya arıza görüntüsü bulunmamaktadır, doğa manzarası yer almaktadır. |
| ✓ rotated-1 | zor durum: 90° döndürülmüş | waste | ok | ok | 2508 | Fotoğrafta arazide bırakılmış çöp poşeti görülmektedir. |
| ✓ upside-1 | zor durum: ters fotoğraf | road | ok | ok | 2653 | Fotoğrafta rögar kapağı ve çevresindeki yol yüzeyi görünmektedir. |
| ✗ tiny-1 | zor durum: 64 px | ice | doubtful | ok | 4250 | Fotoğrafta buzlanma olduğu görülebilmektedir. |
| ✗ bright-1 | zor durum: aşırı pozlama | water | doubtful | ok | 4690 | Fotoğrafta sokaktan yukarı fışkıran su görünmektedir. |
| ✓ typo-1 | zor durum: yazım hatası | road | ok | ok | 2484 | Fotoğrafta yoldaki çukur açıkça görülmektedir. |
| ✓ english-1 | zor durum: İngilizce açıklama | road | ok | ok | 1634 | Fotoğrafta yoldaki çukur açıkça görülmektedir. |
| ✓ mismatch-1 | zor durum: yanlış kategori | ice | unrelated | unrelated | 1783 | Fotoğrafta bildirilen buzlanma sorunu yerine çöp ve atık yığınları görülmektedir. |
| ✓ mismatch-2 | zor durum: yanlış kategori | waste | unrelated | unrelated | 2095 | Fotoğrafta çöp birikmesi veya konteyner yerine yol kenarında hasar görülmektedir. |
| ✓ textinject-1 | zor durum: görsele yazılmış talimat | road | unrelated | unrelated | 1923 | Fotoğrafta yol veya çukur yerine manzarada su ve ağaç görülmektedir. |
