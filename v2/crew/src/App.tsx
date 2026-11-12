import { useCallback, useEffect, useState } from "react";
import { api, session, signedOut } from "./app.ts";
import { Login } from "./screens/Login.tsx";
import { QueueScreen } from "./screens/Queue.tsx";
import { enablePush } from "../../shared/client/native.ts";

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");

  const check = useCallback(async () => {
    if (!(await session.get())) return setSignedIn(false);
    try {
      const me = await api.call<{ role: string }>("/api/me");
      if (me.role !== "crew") {
        await session.clear();
        setNotice("Bu uygulama saha ekipleri içindir. Vatandaş hesapları KentBağ uygulamasını, merkez ve kurumlar web panelini kullanır.");
        return setSignedIn(false);
      }
      setSignedIn(true);
    } catch {
      setSignedIn(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const out = () => setSignedIn(false);
    signedOut.addEventListener("out", out);
    return () => signedOut.removeEventListener("out", out);
  }, [check]);

  useEffect(() => {
    if (!signedIn) return;
    void enablePush(
      (token) => void api.call("/api/push/token", { body: { token, enabled: true } }),
      () => window.dispatchEvent(new Event("kb:refresh")),
    ).catch(() => {});
  }, [signedIn]);

  if (signedIn === null) return <main className="splash muted">KentBağ Ekip açılıyor…</main>;
  if (!signedIn) return <Login notice={notice} onSignedIn={() => void check()} />;
  return (
    <div className="app">
      <QueueScreen
        onSignOut={async () => {
          await session.clear();
          setSignedIn(false);
        }}
      />
    </div>
  );
}
