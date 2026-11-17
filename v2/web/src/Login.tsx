import { useEffect, useState, type FormEvent } from "react";
import { api, session } from "./api.ts";

type DemoAccount = { key: string; label: string; role: string; app: string };

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<DemoAccount[]>([]);
  const [forgot, setForgot] = useState<"no" | "form" | "sent">("no");

  async function requestReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/password/forgot", { body: { email } });
      setForgot("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İstek gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    api<{ accounts: DemoAccount[] }>("/api/demo/accounts")
      .then((r) => setDemo(r.accounts.filter((a) => a.app === "web")))
      .catch(() => setDemo([]));
  }, []);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${base}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const token = r.headers.get("set-auth-token");
      if (!r.ok || !token) throw new Error("E-posta veya şifre hatalı.");
      session.set(token);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(key: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ token: string }>("/api/demo/login", { body: { key } });
      session.set(r.token);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo girişi yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-intro">
        <div className="brand big">
          <span className="brand-mark" aria-hidden="true" />
          KentBağ
        </div>
        <h1>Belediye ve kurum paneli</h1>
        <p className="muted">
          Vatandaş bildirimlerini doğru kuruma ve ekibe ulaştırın, ilerlemeyi tek ekrandan izleyin.
        </p>
        <ol className="route" aria-label="Bir talebin yolu">
          {["Alındı", "İletildi", "Atandı", "Yolda", "Sahada", "Çözüldü"].map((s, i) => (
            <li key={s} className={i < 3 ? "passed" : i === 3 ? "here" : i === 5 ? "final" : ""}>
              <i />
              {s}
            </li>
          ))}
        </ol>
      </section>
      <section className="panel stack login-box">
        {demo.length > 0 && (
          <div className="stack">
            <h2>Demo olarak gir</h2>
            <div className="demo-grid">
              {demo.map((a) => (
                <button key={a.key} disabled={busy} onClick={() => void demoLogin(a.key)}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {forgot !== "no" ? (
          <form className="stack" onSubmit={(e) => void requestReset(e)}>
            <h2>Şifremi unuttum</h2>
            {forgot === "sent" ? (
              <p className="agent-note">Bu adrese kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderildi. E-postanı (gerekirse gereksiz klasörünü) kontrol et.</p>
            ) : (
              <>
                <label>
                  E-posta
                  <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="primary" disabled={busy}>
                  Yenileme bağlantısı gönder
                </button>
              </>
            )}
            <button type="button" className="link" onClick={() => setForgot("no")}>
              Girişe dön
            </button>
          </form>
        ) : (
        <form className="stack" onSubmit={(e) => void signIn(e)}>
          <h2>Personel girişi</h2>
          <label>
            E-posta
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Şifre
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>
            {busy ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
          <button type="button" className="link" onClick={() => setForgot("form")}>
            Şifremi unuttum
          </button>
          <small>Her hesap tek bir role sahiptir: belediye merkezi, kurum veya saha ekibi. Saha ekipleri Android uygulamasını kullanır.</small>
        </form>
        )}
      </section>
    </main>
  );
}
