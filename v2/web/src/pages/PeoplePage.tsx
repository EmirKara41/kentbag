import { useCallback, useState, type FormEvent } from "react";
import { dateTime, institutionIds, institutions, type InstitutionId } from "@kentbag/shared";
import { api, type Account, type Application } from "../api.ts";
import { usePolling } from "../components/hooks.ts";

function Applications({ onChange }: { onChange: () => Promise<void> }) {
  const load = useCallback(() => api<{ applications: Application[] }>("/api/staff/applications").then((r) => r.applications), []);
  const { data, error, refresh } = usePolling(load, 60_000);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/staff/applications/${id}/${decision}`, { body: { note } });
      setRejecting(null);
      setNote("");
      await refresh();
      await onChange();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const pending = (data ?? []).filter((a) => a.status === "pending");
  const decided = (data ?? []).filter((a) => a.status !== "pending").slice(0, 10);
  return (
    <section className="stack">
      <h2>Saha ekibi başvuruları ({pending.length})</h2>
      <p className="muted">Vatandaşlar KentBağ uygulamasındaki Ayarlar ekranından başvurur. Onaylanan kişi aynı e-posta ve şifreyle KentBağ Ekip uygulamasına girer.</p>
      {error && <p className="error">{error}</p>}
      {actionError && <p className="error">{actionError}</p>}
      {data && !pending.length && <p className="muted">Bekleyen başvuru yok.</p>}
      {pending.map((a) => (
        <article key={a.id} className="card">
          <div className="spread">
            <strong>{a.name}</strong>
            <span className="muted">{dateTime(a.createdAt)}</span>
          </div>
          <span>
            {a.teamName} · {a.institutionName}
          </span>
          <span className="muted">
            {a.email} · {a.phone}
          </span>
          {a.note && <p>{a.note}</p>}
          {rejecting === a.id ? (
            <div className="stack">
              <label>
                Ret gerekçesi
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Şu anda ekipte boş yer yok." />
              </label>
              <div className="row">
                <button className="danger" disabled={busy || note.trim().length < 5} onClick={() => void decide(a.id, "reject")}>
                  Reddet
                </button>
                <button className="link" onClick={() => setRejecting(null)}>
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button className="primary" disabled={busy} onClick={() => void decide(a.id, "approve")}>
                Onayla, ekibe ekle
              </button>
              <button disabled={busy} onClick={() => setRejecting(a.id)}>
                Reddet
              </button>
            </div>
          )}
        </article>
      ))}
      {decided.length > 0 && (
        <details>
          <summary>Sonuçlanan başvurular</summary>
          <ul>
            {decided.map((a) => (
              <li key={a.id}>
                {a.name} · {a.teamName} · {a.status === "approved" ? "Onaylandı" : `Reddedildi${a.decisionNote ? `: ${a.decisionNote}` : ""}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function PeoplePage({ role, institution }: { role: "center" | "institution"; institution?: string }) {
  const load = useCallback(() => api<{ accounts: Account[] }>("/api/staff/accounts").then((r) => r.accounts), []);
  const { data, error, refresh } = usePolling(load, 60_000);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: role === "center" ? "institution" : "crew", institution: institution ?? "electricity", teamId: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const instId = (role === "institution" ? institution : form.institution) as InstitutionId;
  const teams = institutions[instId]?.teams ?? [];

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    setDone("");
    try {
      const body = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        institution: form.role === "institution" ? instId : undefined,
        teamId: form.role === "crew" ? form.teamId || teams[0]?.id : undefined,
      };
      const r = await api<{ account: Account }>("/api/staff/accounts", { body });
      setDone(`${r.account.name} için hesap açıldı. İlk şifreyi kendisine iletin; giriş yaptıktan sonra "Şifremi unuttum" ile değiştirebilir.`);
      set({ name: "", email: "", password: "" });
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Hesap açılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a: Account) {
    try {
      await api(`/api/staff/accounts/${a.userId}`, { method: "PATCH", body: { active: !a.active } });
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Değiştirilemedi.");
    }
  }

  return (
    <main className="page">
      <h1>{role === "center" ? "Personel ve başvurular" : "Ekip hesapları ve başvurular"}</h1>
      <div className="grid-2">
        <div className="stack">
          <Applications onChange={refresh} />
          <form className="panel stack" onSubmit={(e) => void create(e)}>
            <h2>Yeni personel hesabı</h2>
            <label>
              Ad soyad
              <input required minLength={2} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label>
              E-posta
              <input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </label>
            <label>
              İlk şifre
              <input required minLength={8} type="text" autoComplete="off" value={form.password} onChange={(e) => set({ password: e.target.value })} />
              <small>En az 8 karakter. Kişi giriş yaptıktan sonra değiştirebilir.</small>
            </label>
            {role === "center" && (
              <label>
                Rol
                <select value={form.role} onChange={(e) => set({ role: e.target.value })}>
                  <option value="center">Belediye merkezi</option>
                  <option value="institution">Kurum</option>
                  <option value="crew">Saha ekibi</option>
                </select>
              </label>
            )}
            {role === "center" && form.role !== "center" && (
              <label>
                Kurum
                <select value={form.institution} onChange={(e) => set({ institution: e.target.value, teamId: "" })}>
                  {institutionIds.map((id) => (
                    <option key={id} value={id}>
                      {institutions[id].name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.role === "crew" && (
              <label>
                Ekip
                <select value={form.teamId || teams[0]?.id} onChange={(e) => set({ teamId: e.target.value })}>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {formError && <p className="error">{formError}</p>}
            {done && <p className="agent-note">{done}</p>}
            <button className="primary" disabled={busy}>
              {busy ? "Açılıyor…" : "Hesabı aç"}
            </button>
          </form>
        </div>
        <section className="stack">
          <h2>Hesaplar</h2>
          {error && <p className="error">{error}</p>}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Kişi</th>
                  <th>Görev</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((a) => (
                  <tr key={a.userId}>
                    <td>
                      <strong>{a.name}</strong>
                      <br />
                      <small>{a.email}</small>
                    </td>
                    <td>{a.role === "crew" ? `${a.teamName} · ${a.institutionName}` : a.role === "institution" ? `Kurum · ${a.institutionName}` : "Belediye merkezi"}</td>
                    <td>
                      <span className={`pill ${a.active ? "live" : "off"}`}>{a.active ? "Açık" : "Kapalı"}</span>
                    </td>
                    <td>
                      <button className="link" onClick={() => void toggle(a)}>
                        {a.active ? "Erişimi kapat" : "Yeniden aç"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
