import { Icon } from "../ui";
export function Help({ privacy = false }: { privacy?: boolean }) {
  return (
    <div className="page help-page">
      <span className="help-hero-icon">
        <Icon name={privacy ? "shield" : "help"} size={34} />
      </span>
      <h1>{privacy ? "Kontrol sende." : "Birlikte, adım adım."}</h1>
      <p className="page-description">
        {privacy
          ? "İzinlerini ve paylaştığın bilgileri tanı."
          : "Bir sorunu bildirmek birkaç adım sürer."}
      </p>
      {privacy ? (
        <>
          <section className="content-card">
            <h2>
              <Icon name="camera" size={20} /> Fotoğraf
            </h2>
            <p>
              Kamera yalnızca fotoğraf çekmek istediğinde açılır. Galerinden de
              fotoğraf seçebilirsin. Fotoğraf eklemek zorunlu değildir.
            </p>
          </section>
          <section className="content-card">
            <h2>
              <Icon name="pin" size={20} /> Konum
            </h2>
            <p>
              “Mevcut konumumu kullan” dediğinde izin istenir. Konumunu
              haritadan kendin de seçebilir veya “Adresi elle yaz” ile açık
              adres girebilirsin. Elle adres girmek için konum izni gerekmez.
              Arka planda konum takibi yapılmaz.
            </p>
          </section>
          <section className="content-card">
            <h2>
              <Icon name="lock" size={20} /> Hesap ve talepler
            </h2>
            <p>
              Gönderdiğin talepler hesabına kaydedilir. Taslakların bu cihazda
              tutulur. Android uygulamasını kaldırmak cihazdaki taslakları
              silebilir.
            </p>
          </section>
          <section className="content-card">
            <h2>
              <Icon name="offline" size={20} /> İnternet bağlantısı
            </h2>
            <p>
              Talep göndermek, hesabına giriş yapmak ve güncellemeleri almak
              için internet gerekir. Bağlantı kesildiğinde hazırladığın taslak
              korunur.
            </p>
          </section>
        </>
      ) : (
        <>
          <div className="help-steps">
            {[
              [
                "camera",
                "Sorunu anlat",
                "Arıza bildirmek veya bir iyileştirme istemek için konuyu seç. İhtiyacı anlat; istersen fotoğraf ekle.",
              ],
              [
                "pin",
                "Konumunu belirle",
                "Haritadan bir nokta seç, mevcut konumunu kullan veya açık adresi tamamen elle yaz. Elle adres girişinde harita noktası gerekmez.",
              ],
              [
                "send",
                "Kontrol et ve gönder",
                "Bilgilerini kontrol edip hesabından gönder. Kayıt onayı ve talep numaran ekranda görünür.",
              ],
              [
                "bell",
                "Gelişmeleri takip et",
                "Talebinin işlem adımları Kayıtlarım'da, yeni gelişmeler bildirim simgesinde yer alır. Sonuç aldığın işler Tamamlanan taleplerim'de birikir.",
              ],
            ].map(([icon, title, text], i) => (
              <section key={title}>
                <span className="help-step-icon">
                  <Icon name={icon} />
                  <b>{i + 1}</b>
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </div>
              </section>
            ))}
          </div>
          <div className="content-card">
            <h2>Sık sorulanlar</h2>
            <details>
              <summary>Mahallem'deki örnekler gerçek mi?</summary>
              <p>
                Hayır. Kurum bağlantısı kurulana kadar içerikler açıkça örnek
                olarak gösterilir. Destek ve takip yalnızca bu cihazda saklanır;
                kuruma gönderilmez. Örnek içerikleri Mahallem'den
                gizleyebilirsin.
              </p>
            </details>
            <details>
              <summary>Tamamlanan taleplerim nasıl oluşur?</summary>
              <p>
                Hesabına ait çözüm bildirilen kayıtlar burada kalır. Geri
                çekilen talepler tamamlanan sayısına eklenmez. Çözüm sonrası
                sorun devam ediyorsa geri dönüş verebilirsin; kaydın devam
                edenler arasında görünür.
              </p>
            </details>
            <details>
              <summary>Fotoğraf eklemek zorunlu mu?</summary>
              <p>
                Hayır. Özellikle elektrik ve su kesintilerinde açıklama ve konum
                yeterlidir.
              </p>
            </details>
            <details>
              <summary>Konum izni vermek zorunda mıyım?</summary>
              <p>
                Hayır. Haritadan bir nokta seçebilir veya adresini tamamen elle
                yazabilirsin.
              </p>
            </details>
            <details>
              <summary>Bildirimim hemen bir ekibe gider mi?</summary>
              <p>
                Önce kaydının alındığı doğrulanır. İnceleme ve ekip ataması
                gerçekleştiğinde ayrıca görünür. Gerçekleşmemiş bir işlem
                tamamlanmış gibi gösterilmez.
              </p>
            </details>
          </div>
          <p className="emergency-note">
            Acil tehlike ve can güvenliği gerektiren durumlar için bu uygulama
            acil müdahale hizmetinin yerini tutmaz.
          </p>
        </>
      )}
    </div>
  );
}
