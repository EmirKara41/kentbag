import { get, set } from "idb-keyval";
import type { Draft } from "./domain";
const key = (owner: string | null) =>
  `kent.mobile.v1.draft.${owner ?? "guest"}`;
export async function readDraft(owner: string | null): Promise<Draft | null> {
  return (await get(key(owner))) ?? null;
}
export async function writeDraft(owner: string | null, draft: Draft | null) {
  await set(key(owner), draft);
}
// Tokens never enter this store or a report/draft export.
