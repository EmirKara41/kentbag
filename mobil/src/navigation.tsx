import { createContext, useContext } from "react";
import type { CategoryId, RequestKind } from "./domain";
export type Tab = "home" | "reports" | "neighborhood" | "account";
export type Route = {
  name:
    | Tab
    | "updates"
    | "wizard"
    | "auth"
    | "help"
    | "privacy"
    | "edit-profile"
    | "detail"
    | "community-detail";
  id?: string;
  created?: boolean;
  filter?: string;
};
export type Navigation = {
  go: (route: Route) => void;
  back: () => void;
  tab: (tab: Tab) => void;
  report: (category?: CategoryId, resume?: boolean, kind?: RequestKind) => void;
  toast: (text: string) => void;
};
export const NavigationContext = createContext<Navigation | null>(null);
export function useNav() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("Navigation is missing");
  return value;
}
