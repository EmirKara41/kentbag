import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { categories, ongoing, type CitizenReport } from "./domain";
import { usePanel } from "./store";
import { CategoryIcon, Empty, Icon, PageHeading } from "./ui";
export default function MapView({ onOpen }: { onOpen: (id: string) => void }) {
  const { data } = usePanel();
  const [all, setAll] = useState(false),
    [category, setCategory] = useState("");
  const reports = useMemo(
    () =>
      data.reports.filter(
        (report) =>
          (all ? report.status !== "withdrawn" : ongoing(report)) &&
          (!category || report.category === category),
      ),
    [data.reports, all, category],
  );
  const located = useMemo(
      () => reports.filter((report) => report.point),
      [reports],
    ),
    unlocated = reports.filter((report) => !report.point);
  return (
    <>
      <PageHeading
        eyebrow="BÖLGESEL GÖRÜNÜM"
        title="Talep haritası"
        body="Haritadaki örnek talepleri aç ve yönlendir. Elle adres verilen kayıtlar ayrıca listelenir."
      />
      <div className="map-toolbar">
        <select
          aria-label="Harita kategori filtresi"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">Tüm kategoriler</option>
          {Object.entries(categories).map(([id, value]) => (
            <option key={id} value={id}>
              {value.name}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={all}
            onChange={(event) => setAll(event.target.checked)}
          />
          Sonuçlananları da göster
        </label>
        <span>
          {located.length} konumlu · {unlocated.length} yalnız adres
        </span>
      </div>
      <div className="map-workspace">
        <div className="map-report-list">
          <div className="map-list-heading">
            <h3>Bu görünümdeki talepler</h3>
            <span>{reports.length}</span>
          </div>
          {reports.map((report) => (
            <button key={report.id} onClick={() => onOpen(report.id)}>
              <CategoryIcon category={report.category} small />
              <span>
                <small>
                  {report.reference} · {report.neighborhood}
                </small>
                <strong>{report.title}</strong>
                <em>
                  {report.point
                    ? categories[report.category].name
                    : "Elle adres · Harita noktası yok"}
                </em>
              </span>
              <Icon name="chevron" size={15} />
            </button>
          ))}
          {!reports.length && <Empty />}
        </div>
        <MapCanvas reports={located} onOpen={onOpen} />
      </div>
      <div className="subtle-note">
        <Icon name="info" size={15} />
        Ekiplerin canlı konumu gösterilmez. İşaretler yalnız örnek taleplere
        aittir; elle girilen adreslerden nokta üretilmez.
      </div>
    </>
  );
}
function MapCanvas({
  reports,
  onOpen,
}: {
  reports: CitizenReport[];
  onOpen: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    if (!root.current) return;
    const map = L.map(root.current, { scrollWheelZoom: false }).setView(
      [41.023, 29.002],
      14,
    );
    let active = true,
      layer: L.TileLayer | null = null,
      timer: ReturnType<typeof setTimeout>;
    const sources = [
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    ];
    function load(index: number) {
      clearTimeout(timer);
      if (layer) map.removeLayer(layer);
      let failed = false,
        errors = 0;
      const current = L.tileLayer(sources[index], {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
          (index
            ? ' &copy; <a href="https://carto.com/attribution">CARTO</a>'
            : ""),
        maxZoom: 19,
        referrerPolicy: "strict-origin-when-cross-origin",
      });
      layer = current;
      function fail() {
        if (!active || failed || layer !== current) return;
        failed = true;
        if (!index) load(1);
        else
          setError(
            "Harita zemini yüklenemedi. Talepleri soldaki listeden inceleyebilirsin.",
          );
      }
      current.on("tileerror", () => {
        if (++errors >= 2) fail();
      });
      current.on("load", () => {
        if (!active || layer !== current) return;
        if (errors) fail();
        else {
          clearTimeout(timer);
          setError("");
        }
      });
      current.addTo(map);
      timer = setTimeout(() => {
        if (current.isLoading()) fail();
      }, 8000);
    }
    load(0);
    for (const report of reports) {
      if (!report.point) continue;
      const marker = L.marker(report.point, {
        title: report.title,
        keyboard: true,
        icon: L.divIcon({
          className: `report-map-pin ${report.priority}`,
          html: "<span></span>",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map);
      const label = document.createElement("span");
      label.textContent = report.title;
      marker.bindTooltip(label).on("click", () => onOpen(report.id));
    }
    if (reports.length)
      map.fitBounds(
        L.latLngBounds(
          reports
            .filter((report) => report.point)
            .map((report) => report.point!),
        ),
        { padding: [45, 45], maxZoom: 16 },
      );
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(root.current);
    return () => {
      active = false;
      clearTimeout(timer);
      resize.disconnect();
      map.remove();
    };
  }, [reports, onOpen, attempt]);
  return (
    <div className="map-canvas-wrap">
      <div
        ref={root}
        className="map-canvas"
        aria-label="Örnek talepler haritası"
        role="region"
      />
      <span className="map-demo-label">ÖRNEK TALEP KONUMLARI</span>
      {error && (
        <div className="map-failure" role="status">
          <Icon name="info" size={17} />
          <span>{error}</span>
          <button
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            Yeniden dene
          </button>
        </div>
      )}
    </div>
  );
}
