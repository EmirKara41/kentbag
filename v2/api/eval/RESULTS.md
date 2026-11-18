# Fotoğraf kontrolü ölçümü

Model: `gemini-3.5-flash-lite` · 15 durum · 2026-11-18 05:43 UTC

| Ölçü | Değer |
|---|---|
| Tam doğruluk (3 sınıf) | 93% (14/15) |
| "Alakasız" kesinlik | 100% |
| "Alakasız" duyarlılık | 100% |
| Gerçek sorunların geçme oranı | 100% |
| Yanlışlıkla bekletilen gerçek sorun | 0 |
| Yanıt süresi (medyan / ort. / en çok) | 1925 / 3246 / 6796 ms |
| Hata / zaman aşımı | 0 |

Karşılaştırma noktası: YZ kontrolü yokken alakasız fotoğrafların %0'ı yakalanır.

## Karışıklık matrisi (satır: beklenen, sütun: model)

| | ok | doubtful | unrelated |
|---|---|---|---|
| **ok** | 8 | 0 | 0 |
| **doubtful** | 1 | 1 | 0 |
| **unrelated** | 0 | 0 | 5 |

## Durumlar

| Durum | Grup | Kategori | Beklenen | Sonuç | ms | Modelin notu |
|---|---|---|---|---|---|---|
| ✓ road-1 | gerçek sorun | road | ok | ok | 5748 | Fotoğrafta asfalttaki çukur ve yol hasarı net bir şekilde görülmektedir. |
| ✓ road-2 | gerçek sorun | road | ok | ok | 1651 | Fotoğrafta kaldırım kenarındaki asfalt bozulması ve çukur net bir şekilde görünmektedir. |
| ✓ road-3 | gerçek sorun | road | ok | ok | 3007 | Fotoğrafta sokak üzerindeki rögar kapağı ve çevresindeki yol durumu görünmektedir. |
| ✓ road-4 | gerçek sorun | road | ok | ok | 1925 | Fotoğrafta yaya yolundaki kırık kapak açıkça görülmektedir. |
| ✓ waste-1 | gerçek sorun | waste | ok | ok | 1732 | Fotoğrafta taşmış çöp konteyneri açıkça görülmektedir. |
| ✓ waste-2 | gerçek sorun | waste | ok | ok | 5206 | Fotoğrafta dolmuş çöp kutuları ve etrafa saçılmış poşetler görülmektedir. |
| ✓ waste-3 | gerçek sorun | waste | ok | ok | 1634 | Fotoğraf, durak yakınında yerlere dökülmüş çöpleri ve taşmış çöp kutusunu göstermektedir. |
| ✓ park-1 | gerçek sorun | park | ok | ok | 5204 | Fotoğrafta göl kenarında devrilmiş bir ağaç görülmektedir, bu da bildirimi doğrulamaktadır. |
| ✓ food-1 | alakasız | road | unrelated | unrelated | 1457 | Fotoğrafta bildirilen yol hasarı yerine yemek görünmektedir. |
| ✓ food-2 | alakasız | waste | unrelated | unrelated | 6796 | Fotoğrafta bildirilen çöp birikmesi sorunuyla ilgisiz bir yemek görüntüsü yer almaktadır. |
| ✓ landscape-1 | alakasız | water | unrelated | unrelated | 1505 | Fotoğraf su kesintisi bildirimiyle ilgisiz bir doğa manzarası içermektedir. |
| ✓ screenshot-1 | alakasız | road | unrelated | unrelated | 1487 | Fotoğraf yol hasarını değil, bir sistem arayüz ekran görüntüsünü göstermektedir. |
| ✓ injection-1 | zor durum | road | unrelated | unrelated | 4863 | Fotoğrafta bildirilen yol hasarı yerine yemek görünmektedir. |
| ✗ dark-1 | zor durum | road | doubtful | ok | 4998 | Fotoğrafta kaldırım üzerindeki kırık kapak görülmektedir. |
| ✓ blur-1 | zor durum | waste | doubtful | doubtful | 1479 | Fotoğraf çok bulanık olduğu için bildirilen çöp sorunu net olarak ayırt edilememektedir. |
