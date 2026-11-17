import { useCallback, useEffect, useState } from "react";
import { api, session, type Me } from "./api.ts";
import { Login } from "./Login.tsx";
import { CenterPage } from "./center/CenterPage.tsx";
import { InstitutionPage } from "./institution/InstitutionPage.tsx";
import { AnnouncementsPage } from "./pages/AnnouncementsPage.tsx";
import { PeoplePage } from "./pages/PeoplePage.tsx";
import { ReportsPage } from "./pages/ReportsPage.tsx";
import { ResetPassword } from "./pages/ResetPassword.tsx";
import { institutions, type InstitutionId } from "@kentbag/shared";

const tabs = [
  { hash: "", label: "Talepler" },
  { hash: "#duyurular", label: "Duyurular" },
  { hash: "#personel", label: "Personel" },
  { hash: "#raporlar", label: "Raporlar" },
];

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  if (location.pathname.startsWith("/sifre")) return <ResetPassword />;
  return <Panel />;
}

function Panel() {
  const hash = useHash();
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
  const staff = me.role === "center" || me.role === "institution";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          KentBağ
        </div>
        {(me.role === "center" || me.role === "institution") && (
          <nav className="tabs" aria-label="Bölümler">
            {tabs.map((t) => (
              <a key={t.hash} href={t.hash || "#"} aria-current={(hash === "#" ? "" : hash) === t.hash ? "page" : undefined}>
                {t.label}
              </a>
            ))}
          </nav>
        )}
        <div className="row">
          <span className="who">{me.name}</span>
          <button className="link" onClick={signOut}>
            Çıkış yap
          </button>
        </div>
      </header>
      {staff && hash === "#duyurular" && (
        <AnnouncementsPage author={me.role === "center" ? "Oltu Belediyesi" : institutions[me.institution as InstitutionId]?.name ?? "Kurum"} />
      )}
      {staff && hash === "#personel" && <PeoplePage role={me.role as "center" | "institution"} institution={me.institution} />}
      {staff && hash === "#raporlar" && <ReportsPage role={me.role as "center" | "institution"} />}
      {me.role === "center" && !tabs.slice(1).some((t) => t.hash === hash) && <CenterPage />}
      {me.role === "institution" && !tabs.slice(1).some((t) => t.hash === hash) && <InstitutionPage institution={me.institution!} />}
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
