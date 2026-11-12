export type Photo = {
  id: string;
  uri: string;
  width?: number;
  height?: number;
};
export type Phase =
  | "assigned"
  | "accepted"
  | "in_progress"
  | "institution_review"
  | "center_review"
  | "published"
  | "declined";
export const stages: Record<Phase, string> = {
  assigned: "Kabulünü bekliyor",
  accepted: "Görev kabul edildi",
  in_progress: "Çalışma sürüyor",
  institution_review: "Kurum kontrolünde",
  center_review: "Merkez onayında",
  published: "Sonuç paylaşıldı",
  declined: "Kuruma iade edildi",
};
export type Job = {
  id: string;
  reference: string;
  title: string;
  description: string;
  address: string;
  point?: { latitude: number; longitude: number };
  photos: Photo[];
  instruction: string;
  category: string;
  // Outages (electricity, water) can be closed with a written result only.
  photoOptional: boolean;
  priority: "low" | "normal" | "high" | "urgent";
  state: "prepared" | "cancelled" | "completed";
  crewState: Phase;
  actionable: boolean;
  createdAt: string;
  reviewNote?: string;
  declineReason?: string;
  result?: { body: string; photos: Photo[]; submittedAt: string };
  events: { id: string; stage: string; body: string; createdAt: string }[];
};
export type Workspace = {
  member: { userId: string; name: string; unitId: string; teamId: string };
  institution: string;
  team: string;
  jobs: Job[];
};
export type Draft = { body: string; photos: Photo[] };
export type Enrollment = {
  kind: 'enrollment';
  state: 'unassigned'|'pending'|'rejected'|'disabled'|'other_role'|'approved';
  application?: {unitId:string;teamId:string;note?:string};
  profiles: {id:string;name:string;teams:{id:string;name:string}[]}[];
};
export type Account = Workspace | Enrollment;
export const priorities = {
  urgent: "Acil",
  high: "Yüksek",
  normal: "Normal",
  low: "Düşük",
};
export const date = (value: string) =>
  new Date(value).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
// The institution sent the result back for correction.
export const needsFix = (job: Job) =>
  job.actionable && job.crewState === "in_progress" && !!job.reviewNote;
export const workable = (job: Job) =>
  job.actionable &&
  ["assigned", "accepted", "in_progress"].includes(job.crewState);
