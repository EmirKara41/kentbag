import { useCallback, useEffect, useState } from "react";
import { api, session, signedOut } from "./app.ts";
import { Login } from "./screens/Login.tsx";
import { Home } from "./screens/Home.tsx";
import { Report } from "./screens/Report.tsx";
import { RequestDetail } from "./screens/RequestDetail.tsx";
import { Settings } from "./screens/Settings.tsx";
import { enablePush } from "../../shared/client/native.ts";

type View = { name: "home" } | { name: "report" } | { name: "detail"; id: string } | { name: "settings" };

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [view, setView] = useState<View>({ name: "home" });

  const check = useCallback(async () => {
    if (!(await session.get())) return setSignedIn(false);
    try {
      const me = await api.call<{ role: string }>("/api/me");
      setSignedIn(me.role === "citizen");
      if (me.role !== "citizen") await session.clear();
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
    if (!signedIn || localStorage.getItem("kb.push") === "off") return;
    void enablePush(
      (token) => void api.call("/api/push/token", { body: { token, enabled: true } }).then(() => localStorage.setItem("kb.push.token", token)),
      (id) => setView({ name: "detail", id }),
    ).catch(() => {});
  }, [signedIn]);

  if (signedIn === null) return <main className="splash muted">KentBağ açılıyor…</main>;
  if (!signedIn) return <Login onSignedIn={() => void check()} />;

  return (
    <div className="app">
      {view.name === "home" && (
        <Home onReport={() => setView({ name: "report" })} onOpen={(id) => setView({ name: "detail", id })} onSettings={() => setView({ name: "settings" })} />
      )}
      {view.name === "report" && <Report onCancel={() => setView({ name: "home" })} onSent={(id) => setView({ name: "detail", id })} />}
      {view.name === "detail" && <RequestDetail id={view.id} onBack={() => setView({ name: "home" })} />}
      {view.name === "settings" && (
        <Settings
          onBack={() => setView({ name: "home" })}
          onSignOut={async () => {
            await session.clear();
            setSignedIn(false);
            setView({ name: "home" });
          }}
        />
      )}
    </div>
  );
}
