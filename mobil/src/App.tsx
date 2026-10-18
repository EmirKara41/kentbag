import { useCallback, useEffect, useRef, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { native } from "./native";
import { useStore } from "./store";
import { NavigationContext, type Route, type Tab } from "./navigation";
import {
  freshDraft,
  type CategoryId,
  type Draft,
  type RequestKind,
} from "./domain";
import { CommunityProvider } from "./community";
import { Neighborhood, CommunityDetail } from "./screens/Neighborhood";
import { Brand, Button, Icon, Message, Sheet } from "./ui";
import { Home } from "./screens/Home";
import { Wizard } from "./screens/Wizard";
import { Account, Auth, EditProfile } from "./screens/Account";
import { Reports, Updates, Detail } from "./screens/Reports";
import { Help } from "./screens/Help";
const labels: Record<Route["name"], string> = {
  home: "Ana sayfa",
  reports: "Kayıtlarım",
  neighborhood: "Mahallem",
  "community-detail": "Mahalleden gelişmeler",
  updates: "Güncellemeler",
  account: "Hesabım",
  wizard: "Yeni bildirim",
  auth: "Hesabına giriş",
  help: "Yardım",
  privacy: "İzinler ve gizlilik",
  "edit-profile": "Profilimi düzenle",
  detail: "Talep ayrıntıları",
};
export default function App() {
  const store = useStore();
  const [history, setHistory] = useState<Route[]>([{ name: "home" }]);
  const route = history.at(-1)!;
  const isTab = ["home", "reports", "neighborhood", "account"].includes(
    route.name,
  );
  const [editor, setEditor] = useState<Draft>(() => freshDraft()),
    [step, setStep] = useState(1),
    [draftOwner, setDraftOwner] = useState<string | null>(null);
  const [resumePrompt, setResumePrompt] = useState(false),
    [category, setCategory] = useState<CategoryId | undefined>(),
    [kind, setKind] = useState<RequestKind>("issue"),
    [discard, setDiscard] = useState(false),
    [toast, setToast] = useState("");
  const scroll = useRef<HTMLElement>(null);
  const backHandler = useRef<() => void>(() => undefined);
  const go = useCallback((next: Route) => {
    setHistory((previous) => [...previous, next]);
  }, []);
  const tab = useCallback((name: Tab) => setHistory([{ name }]), []);
  const notify = useCallback((message: string) => setToast(message), []);
  const openWizard = useCallback(
    (value: Draft) => {
      setEditor(value);
      setDraftOwner(store.profile?.id ?? null);
      setStep(1);
      setHistory((previous) => [
        ...previous.filter((item) => item.name !== "wizard"),
        { name: "wizard" },
      ]);
      setResumePrompt(false);
    },
    [store.profile?.id],
  );
  const report = useCallback(
    (
      selected?: CategoryId,
      resume = false,
      requestKind: RequestKind = "issue",
    ) => {
      if (store.draft && !resume) {
        setCategory(selected);
        setKind(requestKind);
        setResumePrompt(true);
      } else
        openWizard(
          resume && store.draft
            ? store.draft
            : freshDraft(selected, requestKind),
        );
    },
    [store.draft, openWizard],
  );
  const back = useCallback(() => {
    const dialog = document.querySelector("dialog[open]");
    if (dialog) {
      dialog.dispatchEvent(
        new Event("cancel", { bubbles: true, cancelable: true }),
      );
      return;
    }
    if (route.name === "wizard") {
      if (step > 1) {
        setStep((value) => value - 1);
        return;
      }
      setDiscard(true);
      return;
    }
    if (history.length > 1) setHistory((previous) => previous.slice(0, -1));
    else if (route.name !== "home") tab("home");
    else if (native) void NativeApp.minimizeApp();
  }, [route.name, step, history.length, tab]);
  useEffect(() => {
    backHandler.current = back;
  }, [back]);
  useEffect(() => {
    void SplashScreen.hide().catch(() => undefined);
    if (!native) return;
    const listener = NativeApp.addListener("backButton", () =>
      backHandler.current(),
    );
    return () => {
      void listener.then((subscription) => subscription.remove());
    };
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
  }, [route.name, step, route.id, route.filter]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(timer);
  }, [toast]);
  async function closeEditor(save: boolean) {
    try {
      await store.saveDraft(save ? editor : null, draftOwner);
      setDiscard(false);
      setHistory((previous) => previous.slice(0, -1));
      if (save) notify("Taslağın bu cihaza kaydedildi.");
    } catch {
      notify("Taslak kaydedilemedi. Lütfen yeniden dene.");
    }
  }
  const unread =
    store.workspace?.inbox.filter((item) => !item.read).length ?? 0;
  return (
    <CommunityProvider>
      <NavigationContext.Provider
        value={{ go, back, tab, report, toast: notify }}
      >
        <div className="phone-app">
          <header className={`app-header ${isTab ? "" : "sub-header"}`}>
            {isTab ? (
              <>
                <Brand />
                <div className="header-actions">
                  <button
                    className="icon-button"
                    onClick={() => go({ name: "updates" })}
                    aria-label="Güncellemeleri aç"
                  >
                    <Icon name="bell" />
                    {unread > 0 && <span className="badge-dot" />}
                  </button>
                  <button
                    className="header-avatar"
                    onClick={() => tab("account")}
                    aria-label="Hesabıma git"
                  >
                    {store.profile ? (
                      store.profile.name[0].toLocaleUpperCase("tr")
                    ) : (
                      <Icon name="user" size={20} />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  className="icon-button"
                  onClick={back}
                  aria-label="Geri"
                >
                  <Icon name="back" />
                </button>
                <strong>{labels[route.name]}</strong>
                <span className="header-spacer" />
              </>
            )}
          </header>
          {!store.online && (
            <div className="offline-banner" role="status">
              <Icon name="offline" size={16} />
              <span>
                İnternet bağlantısı yok. Taslağını hazırlamaya devam
                edebilirsin.
              </span>
            </div>
          )}
          {store.error && route.name !== "wizard" && route.name !== "auth" && (
            <div className="service-error">
              <Message error>{store.error}</Message>
              {store.profile && (
                <button onClick={() => void store.refresh()}>
                  Tekrar dene
                </button>
              )}
            </div>
          )}
          <main
            ref={scroll}
            className={`app-content ${isTab ? "with-nav" : ""}`}
            id="main-content"
            key={
              route.name === "wizard"
                ? "wizard"
                : route.name + (route.id ?? "") + (route.filter ?? "")
            }
          >
            {route.name === "home" && <Home />}
            {route.name === "reports" && (
              <Reports initialFilter={route.filter} />
            )}
            {route.name === "neighborhood" && <Neighborhood />}
            {route.name === "community-detail" && (
              <CommunityDetail id={route.id!} />
            )}
            {route.name === "updates" && <Updates />}
            {route.name === "account" && <Account />}
            {route.name === "auth" && (
              <Auth
                onComplete={() => {
                  setHistory((previous) => previous.slice(0, -1));
                  notify("Hesabına giriş yaptın.");
                }}
              />
            )}{" "}
            {route.name === "edit-profile" && <EditProfile />}
            {route.name === "wizard" && (
              <Wizard
                draft={editor}
                onChange={setEditor}
                step={step}
                setStep={setStep}
                draftOwner={draftOwner}
                onSaved={(id) => {
                  setHistory([
                    { name: "reports" },
                    { name: "detail", id, created: true },
                  ]);
                  setEditor(freshDraft());
                }}
              />
            )}{" "}
            {route.name === "detail" && (
              <Detail id={route.id!} created={route.created} />
            )}
            {(route.name === "help" || route.name === "privacy") && (
              <Help privacy={route.name === "privacy"} />
            )}
          </main>
          {isTab && (
            <nav className="bottom-nav" aria-label="Ana gezinme">
              {(["home", "reports"] as Tab[]).map((name) => (
                <button
                  key={name}
                  aria-current={route.name === name ? "page" : undefined}
                  className={route.name === name ? "active" : ""}
                  onClick={() => tab(name)}
                >
                  <Icon name={name === "home" ? "home" : "file"} size={23} />
                  <span>{labels[name]}</span>
                </button>
              ))}
              <button
                className="new-report-nav"
                onClick={() => report()}
                aria-label="Sorun bildir"
              >
                <span>
                  <Icon name="plus" size={28} />
                </span>
                <strong>Bildir</strong>
              </button>
              {(["neighborhood", "account"] as Tab[]).map((name) => (
                <button
                  key={name}
                  aria-current={route.name === name ? "page" : undefined}
                  className={route.name === name ? "active" : ""}
                  onClick={() => tab(name)}
                >
                  <span className="nav-icon">
                    <Icon
                      name={name === "neighborhood" ? "building" : "user"}
                      size={23}
                    />
                  </span>
                  <span>{labels[name]}</span>
                </button>
              ))}
            </nav>
          )}
          {toast && (
            <div className="toast" role="status">
              <Icon name="check" size={18} />
              {toast}
            </div>
          )}
          {resumePrompt && (
            <Sheet
              title="Yarım kalan bildirimin var"
              onClose={() => setResumePrompt(false)}
            >
              <p className="muted">
                Taslağına devam edebilir veya yeni bir bildirim
                hazırlayabilirsin.
              </p>
              <Button
                icon="edit"
                onClick={() => {
                  if (store.draft) openWizard(store.draft);
                }}
              >
                Taslağa devam et
              </Button>
              <Button
                variant="secondary"
                onClick={() => openWizard(freshDraft(category, kind))}
              >
                Yeni bildirim hazırla
              </Button>
              <p className="field-note">
                Yeni bildirimde yaptığın değişiklikler bu cihazdaki önceki
                taslağın yerini alır.
              </p>
            </Sheet>
          )}
          {discard && (
            <Sheet
              title="Bildirime sonra mı devam edelim?"
              onClose={() => setDiscard(false)}
            >
              <p className="muted">
                Bilgilerini bu cihaza kaydedip daha sonra tamamlayabilirsin.
              </p>
              <Button icon="file" onClick={() => void closeEditor(true)}>
                Taslağı kaydet ve çık
              </Button>
              <Button variant="ghost" onClick={() => void closeEditor(false)}>
                Taslağı sil ve çık
              </Button>
            </Sheet>
          )}
        </div>
      </NavigationContext.Provider>
    </CommunityProvider>
  );
}
