import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Point } from "./domain";
import { Icon } from "./ui";
const layers = [
  {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  },
  {
    url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution:
      '&copy; OpenStreetMap &copy; <a href="https://carto.com/attribution" target="_blank" rel="noopener">CARTO</a>',
  },
];
const pin = L.divIcon({
  className: "map-pin",
  html: "<span></span>",
  iconSize: [32, 38],
  iconAnchor: [16, 38],
});
export function LocationMap({
  point,
  onChange,
  interactive = true,
}: {
  point: Point | null;
  onChange?: (point: Point) => void;
  interactive?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    marker = useRef<L.Marker | null>(null);
  const latest = useRef({ point, onChange });
  const [attempt, setAttempt] = useState(0),
    [status, setStatus] = useState("Harita yükleniyor…");
  useEffect(() => {
    latest.current = { point, onChange };
  }, [point, onChange]);
  useEffect(() => {
    if (!root.current) return;
    let active = true,
      layer: L.TileLayer | null = null,
      timer: ReturnType<typeof setTimeout>;
    const initial = latest.current.point;
    const instance = L.map(root.current, {
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: false,
      doubleClickZoom: interactive,
    }).setView(
      initial ? [initial.latitude, initial.longitude] : [41.015, 28.979],
      initial ? 16 : 11,
    );
    map.current = instance;
    if (initial)
      marker.current = L.marker([initial.latitude, initial.longitude], {
        icon: pin,
      }).addTo(instance);
    function source(index: number) {
      if (!active) return;
      clearTimeout(timer);
      if (layer) instance.removeLayer(layer);
      const current = L.tileLayer(layers[index].url, {
        maxZoom: 19,
        attribution: layers[index].attribution,
        referrerPolicy: "strict-origin-when-cross-origin",
      });
      layer = current;
      let errors = 0,
        switched = false;
      setStatus(index ? "Harita yeniden yükleniyor…" : "Harita yükleniyor…");
      const fail = () => {
        if (!active || layer !== current || switched) return;
        switched = true;
        if (index === 0) source(1);
        else
          setStatus(
            "Harita yüklenemedi. Yeniden dene veya mevcut konumunu kullan.",
          );
      };
      current.on("tileerror", () => {
        if (++errors >= 2) fail();
      });
      current.on("load", () => {
        if (!active || layer !== current) return;
        if (errors) fail();
        else {
          clearTimeout(timer);
          setStatus("");
        }
      });
      current.addTo(instance);
      timer = setTimeout(() => {
        if (current.isLoading()) fail();
      }, 8000);
    }
    source(0);
    if (interactive)
      instance.on("click", (event: L.LeafletMouseEvent) =>
        latest.current.onChange?.({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
          address: "",
          source: "map",
        }),
      );
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(root.current);
    return () => {
      active = false;
      clearTimeout(timer);
      resize.disconnect();
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, [interactive, attempt]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !point) return;
    const coordinate: L.LatLngExpression = [point.latitude, point.longitude];
    if (marker.current) marker.current.setLatLng(coordinate);
    else marker.current = L.marker(coordinate, { icon: pin }).addTo(instance);
    if (!instance.getBounds().contains(coordinate) || point.source === "gps")
      instance.setView(coordinate, 16);
  }, [point]);
  return (
    <div className="map-wrap">
      <div
        ref={root}
        className="map"
        role="region"
        aria-label="Konum haritası"
        data-testid="location-map"
      />
      <button
        type="button"
        className="map-refresh"
        onClick={() => setAttempt((n) => n + 1)}
        aria-label="Haritayı yeniden yükle"
      >
        <Icon name="refresh" size={18} />
      </button>
      {status && (
        <div className="map-status" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
