import { useState } from "react";
import type { Api } from "./api.ts";

/** "Şifremi unuttum": sends a reset link; the link opens the web page that sets the new password. */
export function ForgotPassword({ api, initialEmail, onBack }: { api: Api; initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.call("/api/password/forgot", { body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İstek gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(e) => void submit(e)}>
      <h2>Şifremi unuttum</h2>
      {sent ? (
        <p className="panel">
          Bu adrese kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderdik. E-postandaki bağlantıyı aç, yeni şifreni belirle ve buraya
          dönüp giriş yap. E-posta gelmediyse gereksiz klasörüne bak.
        </p>
      ) : (
        <>
          <label>
            E-posta
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary big" disabled={busy}>
            {busy ? "Gönderiliyor…" : "Yenileme bağlantısı gönder"}
          </button>
        </>
      )}
      <button type="button" className="link" onClick={onBack}>
        Girişe dön
      </button>
    </form>
  );
}
