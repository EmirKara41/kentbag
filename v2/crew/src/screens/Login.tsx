import { useEffect, useState } from "react";
import { api, session } from "../app.ts";
import { ForgotPassword } from "../../../shared/client/ForgotPassword.tsx";

type DemoAccount = { key: string; label: string; app: string };

export function Login({ notice, onSignedIn }: { notice: string; onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState<DemoAccount[]>([]);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    api
      .call<{ accounts: DemoAccount[] }>("/api/demo/accounts")
      .then((r) => setDemo(r.accounts.filter((a) => a.app === "crew")))
      .catch(() => setDemo([]));
  }, []);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setError("");
    try {
      await session.set(await fn());
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen login">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        KentBağ Ekip
      </div>
      <h1>Sıradaki işin burada.</h1>
      {notice && <p className="agent-note">{notice}</p>}
      {forgot ? (
        <ForgotPassword api={api} initialEmail={email} onBack={() => setForgot(false)} />
      ) : (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.signIn(email.trim(), password));
        }}
      >
        <label>
          E-posta
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Şifre
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary big" disabled={busy}>
          {busy ? "Bekle…" : "Giriş yap"}
        </button>
        <button type="button" className="link" onClick={() => setForgot(true)}>
          Şifremi unuttum
        </button>
      </form>
      )}
      {demo.length > 0 && (
        <section className="stack">
          <h2>Demo ekip olarak gir</h2>
          <select aria-label="Demo ekip" defaultValue="" onChange={(e) => e.target.value && void run(async () => (await api.call<{ token: string }>("/api/demo/login", { body: { key: e.target.value } })).token)}>
            <option value="">Ekip seç</option>
            {demo.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </section>
      )}
    </main>
  );
}
