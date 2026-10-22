import { useEffect, useRef, useState } from "react";
import {
  categories,
  improvementCategories,
  categoryFor,
  draftError,
  validPoint,
  validLocation,
  publicAreas,
  type Draft,
} from "../domain";
import { Button, Icon, Message, Sheet } from "../ui";
import { LocationMap } from "../Map";
import { capturePhoto, currentLocation, native, preparePhoto } from "../native";
import { useStore } from "../store";
import { useNav } from "../navigation";
import { nearbyIncidents, useCommunity } from "../community";
export function Wizard({
  draft,
  onChange,
  step,
  setStep,
  draftOwner,
  onSaved,
}: {
  draft: Draft;
  onChange: (value: Draft) => void;
  step: number;
  setStep: (step: number) => void;
  draftOwner: string | null;
  onSaved: (id: string) => void;
}) {
  const store = useStore(),
    nav = useNav();
  const community = useCommunity();
  const improvement = draft.kind === "improvement";
  const manual = draft.location?.source === "manual";
  const rememberedPoint = useRef(
    validPoint(draft.location) ? draft.location : null,
  );
  const matches = nearbyIncidents(
    draft.location,
    draft.category,
    community.items,
  );
  const { saveDraft } = store;
  const [busy, setBusy] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false),
    [gpsBusy, setGpsBusy] = useState(false),
    [error, setError] = useState(""),
    [photo, setPhoto] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null),
    cameraInput = useRef<HTMLInputElement>(null);
  const selected = draft.category ? categoryFor(draft.category) : null;
  function update(patch: Partial<Draft>) {
    if (patch.location && validPoint(patch.location))
      rememberedPoint.current = patch.location;
    onChange({ ...draft, ...patch, updatedAt: new Date().toISOString() });
    setError("");
  }
  useEffect(() => {
    if (
      busy ||
      (!draft.category &&
        !draft.description &&
        !draft.photos.length &&
        !draft.location)
    )
      return;
    const timeout = setTimeout(() => {
      void saveDraft(draft, draftOwner).catch(() =>
        setError("Taslak kaydedilemedi. Bu ekranı kapatmadan yeniden dene."),
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [draft, draftOwner, busy, saveDraft]);
  async function addPhoto(source: "camera" | "gallery") {
    if (!native) {
      (source === "camera" ? cameraInput : input).current?.click();
      return;
    }
    setPhotoBusy(true);
    setError("");
    try {
      const result = await capturePhoto(source);
      if (result) update({ photos: [...draft.photos, result].slice(0, 3) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf eklenemedi.");
    } finally {
      setPhotoBusy(false);
    }
  }
  async function files(list: FileList | null) {
    if (!list?.length) return;
    setPhotoBusy(true);
    setError("");
    try {
      const results = [];
      for (const file of Array.from(list).slice(0, 3 - draft.photos.length))
        results.push(await preparePhoto(file));
      update({ photos: [...draft.photos, ...results] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf okunamadı.");
    } finally {
      setPhotoBusy(false);
      if (input.current) input.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    }
  }
  async function locate() {
    setGpsBusy(true);
    setError("");
    try {
      const location = await currentLocation();
      update({
        location: { ...location, address: draft.location?.address ?? "" },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konum alınamadı.");
    } finally {
      setGpsBusy(false);
    }
  }
  async function next() {
    setError("");
    if (step === 1) {
      if (!draft.category) {
        setError("Bir sorun türü seç.");
        return;
      }
      if (draft.description.trim().length < 15) {
        setError("Sorunu en az 15 karakterle anlat.");
        return;
      }
    }
    if (step === 2 && !validLocation(draft.location)) {
      setError(
        draft.location?.source === "manual"
          ? "Açık adresi en az 10 karakterle yaz."
          : "Haritadan konum seç veya adresi elle yaz.",
      );
      return;
    }
    try {
      await store.saveDraft(draft, draftOwner);
      setStep(step + 1);
    } catch {
      setError("Taslak kaydedilemedi. Yeniden dene.");
    }
  }
  async function send() {
    const validation = draftError(draft);
    if (validation) {
      setError(validation);
      return;
    }
    if (!store.profile) {
      await store.saveDraft(draft, draftOwner);
      nav.go({ name: "auth" });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const report = await store.submit(draft, draftOwner);
      onSaved(report.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gönderilemedi. Taslağın korunuyor.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wizard-page">
      <div
        className="stepper"
        aria-label={`Adım ${step}: ${["Sorunu anlat", "Konumu belirle", "Kontrol et"][step - 1]}`}
      >
        {["Sorun", "Konum", "Gönder"].map((label, i) => (
          <div key={label} className={step >= i + 1 ? "active" : ""}>
            <span>
              {step > i + 1 ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      <div className="page wizard-content" key={step}>
        <span className="eyebrow">ADIM {step} / 3</span>
        <h1>
          {
            [
              "Neler oluyor?",
              "Sorun tam olarak nerede?",
              "Son bir göz atalım.",
            ][step - 1]
          }
        </h1>
        <p className="page-description">
          {
            [
              "Birkaç ayrıntı, doğru adımın başlangıcı.",
              "Haritadan konum seç veya açık adresi elle yaz.",
              "Bilgilerini kontrol et, bildirimini gönder.",
            ][step - 1]
          }
        </p>
        {step === 1 && (
          <>
            <div className="request-kind" aria-label="Bildirim amacı">
              <button
                className={!improvement ? "selected" : ""}
                aria-pressed={!improvement}
                onClick={() =>
                  update({
                    kind: "issue",
                    category: improvement ? null : draft.category,
                  })
                }
              >
                <Icon name="road" size={21} />
                <strong>Bir sorun var</strong>
                <small>Arıza ve aksaklık</small>
              </button>
              <button
                className={improvement ? "selected" : ""}
                aria-pressed={improvement}
                onClick={() =>
                  update({
                    kind: "improvement",
                    category: !improvement ? null : draft.category,
                  })
                }
              >
                <Icon name="tree" size={21} />
                <strong>Bir iyileştirme istiyorum</strong>
                <small>Mahalle için bir ihtiyaç</small>
              </button>
            </div>
            <fieldset className="category-select">
              <legend>{improvement ? "İstek konusu" : "Sorun türü"}</legend>
              {(improvement ? improvementCategories : categories).map(
                (category) => (
                  <button
                    key={category.id}
                    type="button"
                    role="radio"
                    aria-checked={draft.category === category.id}
                    className={draft.category === category.id ? "selected" : ""}
                    onClick={() => update({ category: category.id })}
                  >
                    <span
                      className="category-icon"
                      style={{ color: category.color, background: category.bg }}
                    >
                      <Icon name={category.icon} />
                    </span>
                    <span>{category.name}</span>
                    <span className="radio-dot">
                      {draft.category === category.id && (
                        <Icon name="check" size={12} />
                      )}
                    </span>
                  </button>
                ),
              )}
            </fieldset>
            <label className="field">
              <span>
                Sorunu anlat <small>Zorunlu</small>
              </span>
              <textarea
                aria-label="Sorun açıklaması"
                placeholder={
                  selected?.hint ??
                  "Ne olduğunu ve ne zamandır devam ettiğini yaz."
                }
                value={draft.description}
                maxLength={2000}
                rows={4}
                onChange={(e) => update({ description: e.target.value })}
              />
              <span className="field-caption">
                <span>En az 15 karakter</span>
                <span>{draft.description.length}/2000</span>
              </span>
            </label>
            <div className="sharing-options">
              <label>
                <input
                  type="checkbox"
                  checked={draft.sharePublicly === true}
                  onChange={(e) => update({ sharePublicly: e.target.checked })}
                />{" "}
                Başkaları bu soruna katılabilsin
              </label>
              <p>
                Yalnız sorun türü, seçtiğin bölge ve yaklaşık konum paylaşılır.
                Açıklama, fotoğraf ve kişisel bilgilerin yalnız kurumda kalır.
              </p>
              {draft.sharePublicly && (
                <label className="field">
                  <span>Paylaşılacak bölge</span>
                  <select
                    value={draft.publicArea ?? "Oltu"}
                    onChange={(e) => update({ publicArea: e.target.value })}
                  >
                    {publicAreas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="field-label">
              Fotoğraf ekle <small>İsteğe bağlı · En fazla 3</small>
            </div>
            <div className="photo-actions">
              <button
                onClick={() => void addPhoto("camera")}
                disabled={photoBusy || draft.photos.length >= 3}
              >
                <Icon name="camera" />
                <span>Fotoğraf çek</span>
              </button>
              <button
                onClick={() => void addPhoto("gallery")}
                disabled={photoBusy || draft.photos.length >= 3}
              >
                <Icon name="gallery" />
                <span>Galeriden seç</span>
              </button>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label="Galeriden fotoğraf seç"
              onChange={(e) => void files(e.target.files)}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              aria-label="Kamerayla fotoğraf çek"
              onChange={(e) => void files(e.target.files)}
            />
            {photoBusy && <p className="muted">Fotoğraf hazırlanıyor…</p>}
            {draft.photos.length > 0 && (
              <div className="photo-grid">
                {draft.photos.map((item) => (
                  <div key={item.id}>
                    <button
                      className="photo-open"
                      onClick={() => setPhoto(item.uri)}
                      aria-label="Fotoğrafı büyüt"
                    >
                      <img src={item.uri} alt="Bildirime eklenen fotoğraf" />
                    </button>
                    <button
                      className="photo-remove"
                      aria-label="Fotoğrafı kaldır"
                      onClick={() =>
                        update({
                          photos: draft.photos.filter((p) => p.id !== item.id),
                        })
                      }
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="field-note">
              <Icon name="info" size={15} />
              Yüzler ve araç plakaları gibi kişisel bilgileri fotoğrafa almamaya
              özen göster.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <div
              className="location-method"
              aria-label="Adres belirleme yöntemi"
            >
              <button
                aria-pressed={!manual}
                className={!manual ? "selected" : ""}
                onClick={() => {
                  if (manual) update({ location: rememberedPoint.current });
                }}
              >
                <Icon name="pin" size={18} />
                Haritadan seç
              </button>
              <button
                aria-pressed={manual}
                className={manual ? "selected" : ""}
                onClick={() => {
                  if (!manual)
                    update({
                      location: {
                        source: "manual",
                        address:
                          draft.manualAddress ?? draft.location?.address ?? "",
                      },
                    });
                }}
              >
                <Icon name="edit" size={18} />
                Adresi elle yaz
              </button>
            </div>
            {manual ? (
              <div className="manual-address-card">
                <label className="field">
                  <span>
                    Açık adres <small>Zorunlu</small>
                  </span>
                  <textarea
                    aria-label="Açık adres"
                    value={draft.location?.address ?? ""}
                    maxLength={500}
                    rows={5}
                    placeholder="İl, ilçe, mahalle, cadde/sokak, kapı numarası ve varsa yakınındaki bir yer"
                    onChange={(event) =>
                      update({
                        manualAddress: event.target.value,
                        location: {
                          source: "manual",
                          address: event.target.value,
                        },
                      })
                    }
                  />
                  <span className="field-caption">
                    <span>En az 10 karakter</span>
                    <span>{draft.location?.address.length ?? 0}/500</span>
                  </span>
                </label>
                <p className="field-note">
                  Harita seçmeden ve konum izni vermeden devam edebilirsin.
                  Ekibin yeri bulabilmesi için adresi ayrıntılı yaz.
                </p>
              </div>
            ) : (
              <>
                <LocationMap
                  point={validPoint(draft.location) ? draft.location : null}
                  onChange={(point) =>
                    update({
                      location: {
                        ...point,
                        address: draft.location?.address ?? "",
                      },
                    })
                  }
                />
                <Button
                  variant="secondary"
                  icon="locate"
                  busy={gpsBusy}
                  onClick={() => void locate()}
                >
                  Mevcut konumumu kullan
                </Button>
                <div
                  className={`location-label ${draft.location ? "located" : ""}`}
                >
                  <Icon name={draft.location ? "check" : "pin"} size={17} />
                  <span>
                    {validPoint(draft.location)
                      ? `${draft.location.latitude.toFixed(5)}, ${draft.location.longitude.toFixed(5)}`
                      : "Konumu seçmek için haritaya dokun."}
                  </span>
                </div>
                <label className="field">
                  <span>
                    Adres tarifi <small>İsteğe bağlı</small>
                  </span>
                  <input
                    placeholder="Sokak, bina veya yakındaki bir yer"
                    value={draft.location?.address ?? ""}
                    maxLength={500}
                    disabled={!draft.location}
                    onChange={(e) => {
                      if (draft.location)
                        update({
                          location: {
                            ...draft.location,
                            address: e.target.value,
                          },
                        });
                    }}
                  />
                </label>
              </>
            )}
            {matches.length > 0 && (
              <div className="incident-match">
                <span className="eyebrow">YAKINDA BENZER BİR ÖRNEK OLAY</span>
                <h2>Bu durum zaten takip ediliyor olabilir.</h2>
                <p>
                  Bu eşleşme örnek veriye dayanır; gerçek bir bölge duyurusu
                  değildir.
                </p>
                {matches.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      void store
                        .saveDraft(draft, draftOwner)
                        .then(() =>
                          nav.go({ name: "community-detail", id: item.id }),
                        )
                        .catch(() =>
                          setError("Taslak kaydedilemedi. Yeniden dene."),
                        );
                    }}
                  >
                    <Icon name={categoryFor(item.category).icon} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.status} · Örnek</small>
                    </span>
                    <Icon name="chevron" size={17} />
                  </button>
                ))}
                <small>
                  Sorunun farklıysa kendi bildirimine devam edebilirsin.
                </small>
              </div>
            )}
            <Message>
              Yalnızca bildirdiğin sorunun konumu paylaşılır. Arka planda
              konumun izlenmez.
            </Message>
          </>
        )}
        {step === 3 && selected && (
          <>
            <div className="review-card">
              <div className="review-title">
                <span
                  className="category-icon"
                  style={{ background: selected.bg, color: selected.color }}
                >
                  <Icon name={selected.icon} />
                </span>
                <div>
                  <small>
                    {improvement ? "İYİLEŞTİRME İSTEĞİ" : "SORUN BİLDİRİMİ"}
                  </small>
                  <h2>{selected.name}</h2>
                </div>
                <button className="text-button" onClick={() => setStep(1)}>
                  Düzenle
                </button>
              </div>
              <p className="review-description">{draft.description}</p>
              {draft.photos.length > 0 && (
                <div className="photo-grid review-photos">
                  {draft.photos.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setPhoto(item.uri)}
                      aria-label="Fotoğrafı büyüt"
                    >
                      <img src={item.uri} alt="Bildirime eklenen fotoğraf" />
                    </button>
                  ))}
                </div>
              )}
              <div className="review-location">
                <Icon name="pin" />
                <div>
                  <strong>
                    {draft.location?.address || "Haritada seçilen konum"}
                  </strong>
                  <small>
                    {validPoint(draft.location)
                      ? draft.location.latitude.toFixed(5)
                      : "Adres elle girildi"}
                    ,{" "}
                    {validPoint(draft.location)
                      ? draft.location.longitude.toFixed(5)
                      : "Harita noktası yok"}
                  </small>
                </div>
                <button className="text-button" onClick={() => setStep(2)}>
                  Düzenle
                </button>
              </div>
            </div>
            <div className="review-info">
              <Icon name="bell" />
              <div>
                <strong>Süreci buradan takip edebilirsin.</strong>
                <p>
                  Kaydın tamamlandığında talep numaranı göreceksin. Yeni
                  gelişmeler Güncellemeler bölümünde yer alacak.
                </p>
              </div>
            </div>
            {!store.profile && (
              <Message>
                Göndermek için hesabına giriş yapman gerekiyor. Hazırladığın
                bilgiler korunacak.
              </Message>
            )}
          </>
        )}
        {error && <Message error>{error}</Message>}
      </div>
      <footer className="wizard-footer">
        <span>
          <Icon name="lock" size={13} /> Bilgilerin güvenle saklanır
        </span>
        {step < 3 ? (
          <Button
            onClick={() => void next()}
            disabled={photoBusy || gpsBusy}
            icon="arrow"
          >
            Devam et
          </Button>
        ) : (
          <Button
            busy={busy}
            disabled={!store.online}
            onClick={() => void send()}
            icon={store.profile ? "send" : "user"}
          >
            {store.profile ? "Bildirimi gönder" : "Giriş yap ve devam et"}
          </Button>
        )}
      </footer>
      {photo && (
        <Sheet title="Fotoğraf" onClose={() => setPhoto(null)} wide>
          <img
            className="full-photo"
            src={photo}
            alt="Bildirime eklenen fotoğraf"
          />
        </Sheet>
      )}
    </div>
  );
}
