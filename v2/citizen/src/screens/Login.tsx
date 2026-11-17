import { useEffect, useState } from "react";
import { api, session } from "../app.ts";
import { ForgotPassword } from "../../../shared/client/ForgotPassword.tsx";

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    api
      .call<{ accounts: { key: string; app: string }[] }>("/api/demo/accounts")
      .then((r) => setDemo(r.accounts.some((a) => a.key === "vatandas")))
      .catch(() => setDemo(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await session.set(await api.signIn(email.trim(), password, mode === "up" ? { name: name.trim() } : undefined));
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin() {
    setBusy(true);
    setError("");
    try {
      await session.set((await api.call<{ token: string }>("/api/demo/login", { body: { key: "vatandas" } })).token);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo girişi yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen login">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        KentBağ
      </div>
      <h1>Mahallendeki sorunu bildir, ekibi yolda gör.</h1>
      {mode === "forgot" ? (
        <ForgotPassword api={api} initialEmail={email} onBack={() => setMode("in")} />
      ) : (
        <>
      <form className="stack" onSubmit={(e) => void submit(e)}>
        {mode === "up" && (
          <label>
            Adın soyadın
            <input required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          E-posta
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Şifre
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "up" && <small>En az 8 karakter.</small>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary big" disabled={busy}>
          {busy ? "Bekle…" : mode === "up" ? "Hesap oluştur" : "Giriş yap"}
        </button>
      </form>
      <button className="link" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Hesabın yok mu? Hesap oluştur" : "Hesabın var mı? Giriş yap"}
      </button>
      {mode === "in" && (
        <button className="link" onClick={() => setMode("forgot")}>
          Şifremi unuttum
        </button>
      )}
        </>
      )}
      {demo && (
        <button className="go" disabled={busy} onClick={() => void demoLogin()}>
          Demo vatandaş olarak gir
        </button>
      )}
    </main>
  );
}
