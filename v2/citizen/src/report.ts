import type { CategoryId, Point } from "@kentbag/shared";

export type ReportDraft = {
  clientRequestId: string;
  category: CategoryId | null;
  description: string;
  address: string;
  point: Point | null;
  photoIds: string[];
};

export function validateReport(d: ReportDraft): string | null {
  if (!d.category) return "Sorunun türünü seç.";
  if (d.description.trim().length < 10) return "Sorunu en az 10 karakterle anlat.";
  if (!d.point && d.address.trim().length < 5) return "Konum seç veya adres yaz.";
  return null;
}

type KeyValue = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const KEY = "kb.report-draft";
const fresh = (): ReportDraft => ({
  clientRequestId: crypto.randomUUID(),
  category: null,
  description: "",
  address: "",
  point: null,
  photoIds: [],
});

/** The draft survives app restarts and keeps its id, so a retried send never creates a second request. */
export function createDraftStore(storage: KeyValue) {
  return {
    load(): ReportDraft {
      try {
        const raw = storage.getItem(KEY);
        if (raw) return { ...fresh(), ...JSON.parse(raw) };
      } catch {
        /* unreadable draft: start a new one */
      }
      const d = fresh();
      storage.setItem(KEY, JSON.stringify(d));
      return d;
    },
    save(d: ReportDraft) {
      storage.setItem(KEY, JSON.stringify(d));
    },
    clear() {
      storage.removeItem(KEY);
    },
  };
}
