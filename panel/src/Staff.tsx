import { useCallback, useEffect, useState, type FormEvent } from "react";
import { institutionProfiles } from "../../sunucu/src/institution-domain";
import { usePanel } from "./store";
import { Button, Message, PageHeading } from "./ui";
import "./staff.css";

export type StaffIdentity = {
  userId: string;
  name: string;
  email: string;
  role: "center" | "institution" | "crew";
  unitId: string | null;
  teamId: string | null;
};
export async function staffRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.message ||
        result.error ||
        result.message ||
        "İşlem tamamlanamadı.",
    );
  return result;
}
export async function signOut() {
  await staffRequest("/api/auth/sign-out", {});
  location.assign("/giris");
}
function destination(user: StaffIdentity) {
  if (user.role === "center") return "/";
  if (user.role === "crew") return "/saha";
  return `/kurumlar/${institutionProfiles.find((p) => p.id === user.unitId)?.slug ?? ""}`;
}
export function StaffLogin({
  onLogin,
  title = "Çalışma alanına giriş",
}: {
  onLogin?: () => Promise<void>;
  title?: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await staffRequest("/api/auth/sign-in/email", { email, password });
      setPassword("");
      if (onLogin) await onLogin();
      else
        location.assign(
          destination(await staffRequest<StaffIdentity>("/api/staff/me")),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="staff-login-shell">
      <form className="staff-login" onSubmit={(e) => void submit(e)}>
        <a className="institution-brand" href="/kurumlar">
          Kent<span>Bağ</span>
        </a>
        <span className="staff-eyebrow">KURUM VE SAHA KOORDİNASYONU</span>
        <h1>{title}</h1>
        <p>
          Merkezin oluşturduğu personel hesabınızla giriş yapın. Yalnızca
          yetkili olduğunuz çalışma alanına erişebilirsiniz.
        </p>
        <label className="field">
          E-posta
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Şifre
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <Message>{error}</Message>}
        <button className="button primary" disabled={busy}>
          {busy ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
        <small>
          Hesap veya erişim sorunu için merkez sorumlusuna başvurun.
        </small>
      </form>
    </div>
  );
}
type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  unitId: string | null;
  teamId: string | null;
  active: boolean;
};
export function StaffManagement() {
  const { staffAdmin, mode } = usePanel();
  const [members, setMembers] = useState<Member[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("institution"),
    [unitId, setUnitId] = useState<string>(institutionProfiles[0].id),
    [teamId, setTeamId] = useState("");
  const refresh = useCallback(async () => {
    const result = await staffAdmin<{ members: Member[] }>("/staff");
    setMembers(result.members);
  }, [staffAdmin]);
  useEffect(() => {
    if (mode === "live") void refresh().catch((e) => setError(e.message));
  }, [mode, refresh]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await staffAdmin("/staff", {
        name,
        email,
        password,
        role,
        ...(role === "center" ? {} : { unitId }),
        ...(role === "crew" ? { teamId } : {}),
      });
      setNotice(
        "Hesap oluşturuldu. Giriş bilgilerini demo kullanıcısına güvenli biçimde iletin.",
      );
      setName("");
      setEmail("");
      setPassword("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hesap kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }
  const profile = institutionProfiles.find((p) => p.id === unitId);
  return (
    <div className="staff-management">
      <PageHeading
        eyebrow="ERİŞİM YÖNETİMİ"
        title="Personel hesapları"
        body="Kurum ve saha hesaplarını merkez oluşturur. Vatandaş kayıtları personel yetkisi vermez."
      />
      {error && <Message>{error}</Message>}
      {notice && (
        <p role="status" className="staff-notice">
          {notice}
        </p>
      )}
      <div className="staff-layout">
        <form onSubmit={(e) => void create(e)} className="staff-form">
          <h2>Yeni personel hesabı</h2>
          <label className="field">
            Ad soyad
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="field">
            E-posta
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="field">
            İlk şifre
            <input
              required
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>En az 12 karakter. Şifreler listede gösterilmez.</small>
          </label>
          <label className="field">
            Yetki
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="institution">Kurum sorumlusu</option>
              <option value="crew">Saha personeli</option>
              <option value="center">Merkez yetkilisi</option>
            </select>
          </label>
          {role !== "center" && (
            <label className="field">
              Kurum
              <select
                value={unitId}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setTeamId("");
                }}
              >
                {institutionProfiles.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {role === "crew" && (
            <label className="field">
              Ekip
              <select
                required
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Ekip seçin</option>
                {profile?.teams.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="button primary" disabled={busy || mode !== "live"}>
            {busy ? "Oluşturuluyor…" : "Hesabı oluştur"}
          </button>
        </form>
        <section className="staff-list">
          <h2>
            Tanımlı hesaplar <small>{members.length}</small>
          </h2>
          {!members.length && <p>Henüz personel hesabı oluşturulmadı.</p>}
          {members.map((m) => (
            <article key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <span>{m.email}</span>
                <small>
                  {m.role === "center"
                    ? "Merkez yetkilisi"
                    : institutionProfiles.find((p) => p.id === m.unitId)?.name}
                  {m.teamId &&
                    ` · ${institutionProfiles.find((p) => p.id === m.unitId)?.teams.find((t) => t.id === m.teamId)?.name}`}
                </small>
              </div>
              {m.active ? (
                <Button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setError("");
                    void staffAdmin("/staff/disable", { id: m.id })
                      .then(refresh)
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Erişimi kapat
                </Button>
              ) : (
                <small>Erişim kapalı</small>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
