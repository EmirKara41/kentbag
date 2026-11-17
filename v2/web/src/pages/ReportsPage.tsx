import { useEffect, useState } from "react";
import { api, download, type Report, type Summary } from "../api.ts";

const ranges = [
  { days: 1, label: "Bugün" },
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
  { days: 90, label: "90 gün" },
];

const duration = (m: number | null) => (m == null ? "–" : m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`);
const percent = (p: number | null) => (p == null ? "–" : `%${p}`);

function Tile({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="tile">
      <span className="muted">{label}</span>
      <strong className="num">{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Rows({ rows, first }: { rows: (Summary & { name: string })[]; first: string }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="num">Talep</th>
            <th className="num">Açık</th>
            <th className="num">Çözülen</th>
            <th className="num">Ort. varış</th>
            <th className="num">Ort. çözüm</th>
            <th className="num">Yeniden açılma</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="num">{r.total}</td>
              <td className="num">{r.open}</td>
              <td className="num">{r.resolved}</td>
              <td className="num">{duration(r.avgArrivalMinutes)}</td>
              <td className="num">{duration(r.avgResolutionMinutes)}</td>
              <td className="num">{percent(r.reopenRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsPage({ role }: { role: "center" | "institution" }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setReport(null);
    api<Report>(`/api/staff/reports?days=${days}`)
      .then((r) => {
        setReport(r);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Rapor yüklenemedi."));
  }, [days]);

  async function csv() {
    try {
      await download(`/api/staff/reports.csv?days=${days}`, `kentbag-rapor-son-${days}-gun.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV indirilemedi.");
    }
  }

  const s = report?.summary;
  return (
    <main className="page">
      <div className="spread">
        <h1>Raporlar</h1>
        <div className="row">
          <div className="row" role="group" aria-label="Zaman aralığı">
            {ranges.map((r) => (
              <button key={r.days} aria-pressed={days === r.days} className={days === r.days ? "primary" : ""} onClick={() => setDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => void csv()}>CSV indir</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {!report && !error && <p className="muted">Rapor hazırlanıyor…</p>}
      {s && (
        <>
          <div className="tiles">
            <Tile label="Talep" value={s.total} note={`${s.improvements} iyileştirme önerisi · ${s.merged} birleştirilen`} />
            <Tile label="Açık" value={s.open} note={role === "center" && report.unrouted ? `${report.unrouted} tanesi kurum bekliyor` : "henüz kapanmamış"} />
            <Tile label="Ortalama varış" value={duration(s.avgArrivalMinutes)} note="bildirimden ekibin sahaya varışına" />
            <Tile label="Ortalama çözüm" value={duration(s.avgResolutionMinutes)} note="bildirimden kapanışa (arızalar)" />
            <Tile label="Yeniden açılma" value={percent(s.reopenRate)} note="kapanıp vatandaşın yeniden açtığı" />
          </div>
          {role === "center" && (
            <section className="stack">
              <h2>Kurumlara göre</h2>
              <Rows rows={report.byInstitution} first="Kurum" />
            </section>
          )}
          <section className="stack">
            <h2>Kategorilere göre</h2>
            {report.byCategory.length ? <Rows rows={report.byCategory} first="Kategori" /> : <p className="muted">Bu aralıkta talep yok.</p>}
          </section>
        </>
      )}
    </main>
  );
}
