import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { categories, oltuCenter, type CategoryId, type RequestKind } from "@kentbag/shared";
import { api, type CitizenView, type NearbyProblem } from "../app.ts";
import { createDraftStore, validateReport, type ReportDraft } from "../report.ts";
import { ContactList, type Contact } from "../../../shared/client/Referral.tsx";
import { capturePhoto, currentPosition, isNative, preparePhoto, type LocalPhoto } from "../../../shared/client/native.ts";

const drafts = createDraftStore(localStorage);
const categoriesOf = (kind: RequestKind) => (Object.keys(categories) as CategoryId[]).filter((id) => categories[id].kind === kind);

/** Warns before sending when the spot is outside Oltu, and gives the numbers to call instead. */
function AreaWarning({ point, category }: { point: { lat: number; lng: number }; category: CategoryId }) {
  const [area, setArea] = useState<{ outside: boolean; message?: string; contacts?: Contact[] } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), category });
    api
      .call<{ outside: boolean; message?: string; contacts?: Contact[] }>(`/api/area?${q}`)
      .then(setArea)
      .catch(() => setArea(null));
  }, [point.lat, point.lng, category]);
  if (!area?.outside) return null;
  return (
    <section className="panel stack referral" role="status">
      <strong>Bu yer Oltu Belediyesi'nin yetki alanı dışında</strong>
      <span>{area.message}</span>
      <ContactList contacts={area.contacts ?? []} />
      <small className="muted">Yine de gönderebilirsin; talebin kaydedilir ve bu numaralar talep sayfanda da durur.</small>
    </section>
  );
}

/** Open reports of the same problem near the chosen spot; joining one beats a duplicate report. */
function Nearby({ point, category, onJoined }: { point: { lat: number; lng: number }; category: CategoryId; onJoined: (id: string) => void }) {
  const [items, setItems] = useState<NearbyProblem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const q = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), category });
    api
      .call<{ requests: NearbyProblem[] }>(`/api/requests/nearby?${q}`)
      .then((r) => setItems(r.requests))
      .catch(() => setItems([]));
  }, [point.lat, point.lng, category]);
  if (!items.length) return null;
  const improvement = categories[category].kind === "improvement";
  async function join(id: string) {
    setBusy(true);
    setError("");
    try {
      const { request } = await api.call<{ request: CitizenView }>(`/api/requests/${id}/support`, { body: { point } });
      onJoined(request.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Katılınamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="nearby" aria-label="Yakındaki aynı sorunlar">
      <strong>{improvement ? "Yakında aynı öneri var" : "Bu sorun yakında zaten bildirilmiş"}</strong>
      <span className="muted">Aynı sorunsa yeni talep açmak yerine katıl: ilerlemeyi sen de görürsün, bildirim alırsın.</span>
      {items.map((n) => (
        <div key={n.id} className="nearby-item">
          <span>
            <strong>{n.categoryName}</strong> · yaklaşık {n.distanceMeters} m · {n.statusLabel}
          </span>
          {n.supporting ? (
            <button onClick={() => onJoined(n.id)}>Takip ediyorsun · aç</button>
          ) : (
            <button className="go" disabled={busy} onClick={() => void join(n.id)}>
              {improvement ? "Ben de destekliyorum" : "Ben de etkileniyorum"}
            </button>
          )}
        </div>
      ))}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function PickMap({ point, onPick }: { point: { lat: number; lng: number } | null; onPick: (p: { lat: number; lng: number }) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const start = point ?? oltuCenter;
    const m = L.map(ref.current).setView([start.lat, start.lng], point ? 17 : 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => void m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!map.current) return;
    marker.current?.remove();
    if (point) {
      marker.current = L.circleMarker([point.lat, point.lng], { radius: 10, color: "#1d262b", weight: 3, fillColor: "#f2b705", fillOpacity: 1 }).addTo(map.current);
      map.current.setView([point.lat, point.lng], Math.max(map.current.getZoom(), 16));
    }
  }, [point]);
  return <div className="map" ref={ref} />;
}

export function Report({ onCancel, onSent }: { onCancel: () => void; onSent: (id: string) => void }) {
  const [draft, setDraft] = useState<ReportDraft>(() => drafts.load());
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [kind, setKind] = useState<RequestKind>(() => (draft.category ? categories[draft.category].kind : "issue"));
  const improvement = kind === "improvement";
  const update = (patch: Partial<ReportDraft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      drafts.save(next);
      return next;
    });

  async function locate() {
    setLocating(true);
    setError("");
    try {
      update({ point: await currentPosition() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konum alınamadı.");
    } finally {
      setLocating(false);
    }
  }

  async function addPhoto(source: "camera" | "gallery", file?: File) {
    setError("");
    try {
      const p = file ? await preparePhoto(file) : await capturePhoto(source);
      if (p) setPhotos((list) => [...list, p].slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf eklenemedi.");
    }
  }

  async function send() {
    const problem = validateReport(draft);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      const photoIds = await Promise.all(photos.map((p) => api.uploadPhoto(p)));
      const { request } = await api.call<{ request: CitizenView }>("/api/requests", {
        body: { ...draft, photoIds, address: draft.address.trim() },
      });
      drafts.clear();
      onSent(request.id);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Gönderilemedi."} Bilgilerin kayıtlı, tekrar deneyebilirsin.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <header className="spread">
        <button className="link" onClick={onCancel}>
          Vazgeç
        </button>
        <h1 className="title">{improvement ? "Öneri gönder" : "Sorun bildir"}</h1>
        <span />
      </header>
      <div className="kind-switch" role="group" aria-label="Talep türü">
        <button aria-pressed={!improvement} onClick={() => (setKind("issue"), update({ category: null }))}>
          Arıza bildir
        </button>
        <button aria-pressed={improvement} onClick={() => (setKind("improvement"), update({ category: null }))}>
          İyileştirme öner
        </button>
      </div>
      <section className="stack">
        <h2>{improvement ? "Ne önerirsin?" : "Ne oldu?"}</h2>
        {improvement && <small className="muted">Öneriler ekibe değil ilgili kuruma gider; kurum planlar ya da gerekçesiyle yanıtlar.</small>}
        <div className="category-grid">
          {categoriesOf(kind).map((id) => (
            <button key={id} className="category" aria-pressed={draft.category === id} onClick={() => update({ category: id })}>
              {categories[id].name}
            </button>
          ))}
        </div>
        <label>
          Kısaca anlat
          <textarea
            maxLength={1000}
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder={improvement ? "Örn. Okul yolundaki sokak çok karanlık, aydınlatma konulsun." : "Örn. Sokağımızda sabahtan beri elektrik yok."}
          />
        </label>
      </section>
      <section className="stack">
        <h2>Nerede?</h2>
        <button disabled={locating} onClick={() => void locate()}>
          {locating ? "Konum alınıyor…" : draft.point ? "Konumu yeniden al" : "Bulunduğum yeri kullan"}
        </button>
        <PickMap point={draft.point} onPick={(point) => update({ point })} />
        <small className="muted">Haritada dokunarak da yer seçebilirsin.</small>
        <label>
          Adres veya tarif
          <input value={draft.address} maxLength={300} onChange={(e) => update({ address: e.target.value })} placeholder="Örn. Cumhuriyet Mah. Lale Sok. No 4" />
        </label>
      </section>
      {draft.point && draft.category && <AreaWarning point={draft.point} category={draft.category} />}
      {draft.point && draft.category && (
        <Nearby
          point={draft.point}
          category={draft.category}
          onJoined={(id) => {
            drafts.clear();
            onSent(id);
          }}
        />
      )}
      <section className="stack">
        <h2>Fotoğraf (isteğe bağlı)</h2>
        <div className="photos">
          {photos.map((p) => (
            <button key={p.id} className="photo-thumb" onClick={() => setPhotos((l) => l.filter((x) => x.id !== p.id))} aria-label="Fotoğrafı kaldır">
              <img src={p.uri} alt="" />
            </button>
          ))}
        </div>
        {photos.length < 3 && (
          <div className="row">
            {isNative ? (
              <>
                <button onClick={() => void addPhoto("camera")}>Fotoğraf çek</button>
                <button onClick={() => void addPhoto("gallery")}>Galeriden seç</button>
              </>
            ) : (
              <label className="button">
                Fotoğraf ekle
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void addPhoto("gallery", e.target.files[0])} />
              </label>
            )}
          </div>
        )}
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary big sticky" disabled={busy} onClick={() => void send()}>
        {busy ? "Gönderiliyor…" : "Gönder"}
      </button>
    </main>
  );
}
