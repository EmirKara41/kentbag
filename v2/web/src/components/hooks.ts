import { useCallback, useEffect, useState } from "react";
import { api, type AgentSettings } from "../api.ts";

/** Loads data now and every `ms`; also asks the server to retry stuck requests. */
export function usePolling<T>(load: () => Promise<T>, ms = 30_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veriler yüklenemedi.");
    }
  }, [load]);
  useEffect(() => {
    void api("/api/agent/sweep", { method: "POST", body: {} }).catch(() => {});
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void api("/api/agent/sweep", { method: "POST", body: {} }).catch(() => {});
      void refresh();
    }, ms);
    return () => clearInterval(timer);
  }, [refresh, ms]);
  return { data, error, refresh };
}

export function useAgentSettings() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  useEffect(() => {
    api<AgentSettings>("/api/staff/agent").then(setSettings).catch(() => {});
  }, []);
  const update = async (body: Partial<AgentSettings>) => setSettings(await api<AgentSettings>("/api/staff/agent", { method: "PUT", body }));
  return { settings, update };
}
