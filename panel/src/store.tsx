import { createContext, useContext, useState, type ReactNode } from "react";
import { applyAction, type Action, type PanelState } from "./domain";
import { seedState } from "./fixtures";
const key = "kentbag-panel-demo-v1";
function read() {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: seedState(), error: "" };
    const data = JSON.parse(raw) as PanelState;
    if (
      data.version !== 1 ||
      !Array.isArray(data.reports) ||
      !Array.isArray(data.teams) ||
      !Array.isArray(data.announcements) ||
      !Array.isArray(data.works) ||
      !Array.isArray(data.audit)
    )
      throw new Error();
    return { data, error: "" };
  } catch {
    return {
      data: seedState(),
      error:
        "Kaydedilmiş örnek çalışma okunamadı. Mevcut kayıt üzerine yazılmadı; sıfırlamayı seçebilirsin.",
    };
  }
}
function usePanelStore() {
  const [saved, setSaved] = useState(read),
    [error, setError] = useState(saved.error);
  const [notice, setNotice] = useState("");
  function persist(data: PanelState) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      throw new Error(
        "Değişiklik kaydedilemedi. Tarayıcı depolama alanını kontrol et; işlem uygulanmadı.",
      );
    }
    setSaved({ data, error: "" });
    setError("");
  }
  function act(action: Action) {
    if (saved.error) throw new Error(saved.error);
    persist(applyAction(saved.data, action));
    setNotice("Örnek değişiklik bu tarayıcıya kaydedildi.");
  }
  function reset() {
    persist(seedState());
    setNotice("Örnek çalışma başlangıç durumuna döndürüldü.");
  }
  return { data: saved.data, error, act, reset, notice, setNotice };
}
const Context = createContext<ReturnType<typeof usePanelStore> | null>(null);
export function PanelProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={usePanelStore()}>{children}</Context.Provider>
  );
}
export function usePanel() {
  const value = useContext(Context);
  if (!value) throw new Error("Panel provider missing");
  return value;
}
