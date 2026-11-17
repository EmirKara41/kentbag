import { useEffect, useState } from "react";
import { institutionIds, institutions, type InstitutionId } from "@kentbag/shared";
import { api } from "../app.ts";

type Application = { id: string; teamName: string; institutionName: string; status: "pending" | "approved" | "rejected"; decisionNote: string | null };

/** "Saha ekibine başvur": the institution approves; then the same account signs in to KentBağ Ekip. */
export function Apply() {
  const [current, setCurrent] = useState<Application | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState<InstitutionId>("electricity");
  const [teamId, setTeamId] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .call<{ application: Application | null }>("/api/applications/mine")
      .then((r) => setCurrent(r.application))
      .catch(() => setCurrent(null));
  }, []);

  const teams = institutions[institution].teams;

  async function send() {
    setBusy(true);
    setError("");
    try {
      const r = await api.call<{ application: Application }>("/api/applications", { body: { teamId: teamId || teams[0].id, phone, note } });
      setCurrent(r.application);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Başvuru gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (current === undefined) return null;
  return (
    <section className="panel stack">
      <strong>Saha ekibinde mi çalışıyorsun?</strong>
      {current?.status === "pending" && (
        <p className="note">
          {current.teamName} ({current.institutionName}) başvurun inceleniyor. Onaylanınca aynı e-posta ve şifreyle KentBağ Ekip uygulamasına girersin.
        </p>
      )}
      {current?.status === "approved" && <p className="note">Başvurun onaylandı. KentBağ Ekip uygulamasına bu hesapla giriş yap.</p>}
      {current?.status === "rejected" && (
        <p className="note">
          {current.teamName} başvurun kabul edilmedi{current.decisionNote ? `: ${current.decisionNote}` : "."}
        </p>
      )}
      {current?.status !== "pending" && !open && (
        <>
          <p className="muted">Belediye ya da hizmet kurumunun saha ekibindeysen başvur; kurum onaylayınca işlerini KentBağ Ekip uygulamasından alırsın.</p>
          <button onClick={() => setOpen(true)}>Saha ekibine başvur</button>
        </>
      )}
      {open && (
        <div className="stack">
          <label>
            Kurum
            <select value={institution} onChange={(e) => (setInstitution(e.target.value as InstitutionId), setTeamId(""))}>
              {institutionIds.map((id) => (
                <option key={id} value={id}>
                  {institutions[id].name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ekip
            <select value={teamId || teams[0].id} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Telefon
            <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
          </label>
          <label>
            Not (isteğe bağlı)
            <textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. 5 yıldır şebeke bakımında teknisyenim." />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="primary" disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={() => void send()}>
              Başvuruyu gönder
            </button>
            <button className="link" onClick={() => setOpen(false)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
