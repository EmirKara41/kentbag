import { useState, type FormEvent } from "react";

const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** Landing page of the reset e-mail, for every role (citizen, crew, staff). */
export function ResetPassword() {
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") ? "Bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bir bağlantı iste." : "");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== again) return setError("İki şifre aynı değil.");
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!r.ok) throw new Error("Bağlantının süresi dolmuş ya da daha önce kullanılmış. Uygulamadan yeni bir bağlantı iste.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre değiştirilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-screen">
      <div className="panel stack narrow">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          KentBağ
        </div>
        <h1>Yeni şifre</h1>
        {done ? (
          <>
            <p>Şifren değişti. Artık uygulamada ya da panelde yeni şifrenle giriş yapabilirsin. Açık oturumların güvenlik için kapatıldı.</p>
            <a href="/">Panele dön</a>
          </>
        ) : !token ? (
          <p className="error">{error || "Bu sayfa e-postadaki bağlantıyla açılır."}</p>
        ) : (
          <form className="stack" onSubmit={(e) => void submit(e)}>
            <label>
              Yeni şifre
              <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <small>En az 8 karakter.</small>
            </label>
            <label>
              Yeni şifre (tekrar)
              <input type="password" required minLength={8} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>
              {busy ? "Kaydediliyor…" : "Şifremi değiştir"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
