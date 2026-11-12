import { useCallback, useEffect, useState } from "react";
import { api, session, type Me } from "./api.ts";
import { Login } from "./Login.tsx";
import { CenterPage } from "./center/CenterPage.tsx";
import { InstitutionPage } from "./institution/InstitutionPage.tsx";

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!session.get());

  const load = useCallback(async () => {
    if (!session.get()) return setMe(null);
    setLoading(true);
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const out = () => setMe(null);
    window.addEventListener("kb:signed-out", out);
    return () => window.removeEventListener("kb:signed-out", out);
  }, [load]);

  const signOut = () => {
    session.clear();
    setMe(null);
  };

  if (loading) return <main className="center-screen muted">Yükleniyor…</main>;
  if (!me) return <Login onSignedIn={load} />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          KentBağ
        </div>
        <div className="row">
          <span className="who">{me.name}</span>
          <button className="link" onClick={signOut}>
            Çıkış yap
          </button>
        </div>
      </header>
      {me.role === "center" && <CenterPage />}
      {me.role === "institution" && <InstitutionPage institution={me.institution!} />}
      {(me.role === "crew" || me.role === "citizen") && (
        <main className="center-screen">
          <div className="panel stack narrow">
            <h1>Bu hesap web paneline giremez</h1>
            <p>
              {me.role === "crew"
                ? "Saha ekipleri işlerini KentBağ Ekip Android uygulamasından yürütür."
                : "Vatandaş hesapları sorun bildirmek için KentBağ Android uygulamasını kullanır."}
            </p>
            <button onClick={signOut}>Başka hesapla gir</button>
          </div>
        </main>
      )}
    </div>
  );
}
