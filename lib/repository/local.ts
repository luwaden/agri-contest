import { isLiveL2Review, type Level2Application, type Level2Invite, type Level2Review } from "@/types/level2";
import type { EmailCampaign, EmailLogRow } from "@/types/email";
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Application, ApplicationStatus } from "@/types/application";
import type { ApplicationRepository, AuditEvent, ConfigRow, DraftRecord } from "./types";
import type { MentorApplication, MentorStatus } from "@/types/mentor";
import type { StaffAccount } from "@/types/staff";
import type { PanelReview } from "@/types/review";

interface Store { applications: Application[]; drafts: DraftRecord[]; events: AuditEvent[]; mentors?: MentorApplication[]; staff?: StaffAccount[]; reviews?: PanelReview[]; campaigns?: EmailCampaign[]; emailLog?: EmailLogRow[]; level2?: Level2Application[]; level2Invites?: Level2Invite[]; configuration?: ConfigRow[]; level2Reviews?: Level2Review[] }
const FILE = path.join(process.cwd(), ".data", "dev-store.json");

let queue: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => { const p = queue.then(fn, fn); queue = p.catch(() => undefined); return p; };

async function load(): Promise<Store> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); }
  catch { return { applications: [], drafts: [], events: [] }; }
}
async function save(s: Store) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2));
}

/** Development-only backend with the same contract as SheetsRepository. Stores to .data/ (git-ignored). */
export class LocalRepository implements ApplicationRepository {
  readonly kind = "local" as const;
  createApplication = (app: Application) => serial(async () => {
    const s = await load();
    if (s.applications.some((a) => a.applicationId === app.applicationId)) throw new Error("DUPLICATE_ID");
    s.applications.push(app); await save(s);
  });
  getApplications = () => serial(async () => (await load()).applications);
  getApplicationById = (id: string) => serial(async () => (await load()).applications.find((a) => a.applicationId === id) ?? null);
  updateApplication = (app: Application) => serial(async () => {
    const s = await load(); const i = s.applications.findIndex((a) => a.applicationId === app.applicationId);
    if (i === -1) throw new Error("NOT_FOUND");
    s.applications[i] = { ...app, metadata: { ...app.metadata, updatedAt: new Date().toISOString() } }; await save(s);
  });
  updateStatus = (id: string, status: ApplicationStatus, actor: string) => serial(async () => {
    const s = await load(); const a = s.applications.find((x) => x.applicationId === id);
    if (!a) return null;
    const previous = a.submissionStatus; a.submissionStatus = status; a.metadata.updatedAt = new Date().toISOString();
    s.events.push({ at: a.metadata.updatedAt, applicationId: id, actor, action: "STATUS_CHANGED", detail: `${previous} → ${status}` });
    await save(s); return a;
  });
  saveDraft = (d: DraftRecord) => serial(async () => {
    const s = await load(); s.drafts = s.drafts.filter((x) => x.tokenHash !== d.tokenHash); s.drafts.push(d); await save(s);
  });
  getDraft = (h: string) => serial(async () => (await load()).drafts.find((d) => d.tokenHash === h) ?? null);
  deleteDraft = (h: string) => serial(async () => { const s = await load(); s.drafts = s.drafts.filter((d) => d.tokenHash !== h); await save(s); });
  createMentor = (m: MentorApplication) => serial(async () => {
    const s = await load(); s.mentors ??= [];
    if (s.mentors.some((x) => x.mentorId === m.mentorId)) throw new Error("DUPLICATE_ID");
    s.mentors.push(m); await save(s);
  });
  getMentors = () => serial(async () => (await load()).mentors ?? []);
  getMentorById = (id: string) => serial(async () => ((await load()).mentors ?? []).find((m) => m.mentorId === id) ?? null);
  updateMentorStatus = (id: string, status: MentorStatus, actor: string) => serial(async () => {
    const s = await load(); const m = (s.mentors ?? []).find((x) => x.mentorId === id); if (!m) return null;
    const prev = m.status; m.status = status; m.updatedAt = new Date().toISOString();
    s.events.push({ at: m.updatedAt, applicationId: id, actor, action: "MENTOR_STATUS_CHANGED", detail: `${prev} → ${status}` });
    await save(s); return m;
  });
  getEvents = (limit = 200) => serial(async () => (await load()).events.slice(-limit).reverse());
  getStaff = () => serial(async () => ((await load()).staff ?? []).map((a) => ({ ...a, source: "sheet" as const })));
  createStaff = (a: StaffAccount) => serial(async () => {
    const s = await load(); s.staff ??= [];
    if (s.staff.some((x) => x.email.toLowerCase() === a.email.toLowerCase())) throw new Error("DUPLICATE_EMAIL");
    s.staff.push({ ...a, email: a.email.toLowerCase(), source: "sheet" }); await save(s);
  });
  updateStaff = (email: string, patch: Partial<Pick<StaffAccount, "name" | "role" | "active" | "note" | "passwordHash">>) => serial(async () => {
    const s = await load(); const a = (s.staff ?? []).find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!a) return null;
    Object.assign(a, patch, { updatedAt: new Date().toISOString() }); await save(s); return { ...a, source: "sheet" as const };
  });
  diagnose = async () => ({ ok: true, kind: "local", tabs: { Applications: "ok" as const }, headerOk: null });
  countDrafts = () => serial(async () => (await load()).drafts.length);
  logEvent = (e: AuditEvent) => serial(async () => { const s = await load(); s.events.push(e); await save(s); });
  getReviews = () => serial(async () => (await load()).reviews ?? []);
  createReviews = (list: PanelReview[]) => serial(async () => {
    const s = await load(); s.reviews ??= [];
    const have = new Set(s.reviews.map((r) => `${r.applicationId}|${r.panelEmail}`)); let added = 0;
    for (const r of list) { const k = `${r.applicationId}|${r.panelEmail}`; if (have.has(k)) continue; have.add(k); s.reviews.push(r); added++; }
    await save(s); return added;
  });
  updateReview = (id: string, patch: Partial<PanelReview>) => serial(async () => {
    const s = await load(); const r = (s.reviews ?? []).find((x) => x.reviewId === id); if (!r) return null;
    Object.assign(r, patch, { reviewId: r.reviewId, applicationId: r.applicationId, panelEmail: r.panelEmail, updatedAt: patch.updatedAt ?? new Date().toISOString() });
    await save(s); return { ...r };
  });
  updateReviews = (changes: Array<{ reviewId: string; patch: Partial<PanelReview> }>) => serial(async () => {
    const s = await load(); const out: PanelReview[] = []; const at = new Date().toISOString();
    for (const { reviewId, patch } of changes) {
      const r = (s.reviews ?? []).find((x) => x.reviewId === reviewId); if (!r) continue;
      Object.assign(r, patch, { reviewId: r.reviewId, applicationId: r.applicationId, panelEmail: r.panelEmail, updatedAt: patch.updatedAt ?? at }); out.push({ ...r });
    }
    await save(s); return out;
  });
  createEmailCampaign = (c: EmailCampaign) => serial(async () => { const s = await load(); (s.campaigns ??= []).push(c); await save(s); });
  getEmailCampaigns = () => serial(async () => (await load()).campaigns ?? []);
  getEmailLog = () => serial(async () => (await load()).emailLog ?? []);
  appendEmailLog = (rows: EmailLogRow[]) => serial(async () => { const s = await load(); (s.emailLog ??= []).push(...rows); await save(s); });
  getLevel2Reviews = () => serial(async () => ((await load()).level2Reviews ?? []).map((r): Level2Review => ({ ...r, percent: r.percent ?? null, topRank: r.topRank ?? null, topReason: r.topReason ?? "", legacy: r.legacy ?? null })));   // rows saved before the current marking sheet
  createLevel2Reviews = (rows: Level2Review[]) => serial(async () => {
    const s = await load(); s.level2Reviews ??= [];
    const live = new Set(s.level2Reviews.filter(isLiveL2Review).map((r) => r.level1Code)); let n = 0;
    for (const r of rows) { if (live.has(r.level1Code)) continue; live.add(r.level1Code); s.level2Reviews.push(r); n++; }
    await save(s); return n;
  });
  updateLevel2Reviews = (changes: Array<{ reviewId: string; patch: Partial<Level2Review> }>) => serial(async () => {
    const s = await load(); const out: Level2Review[] = []; const at = new Date().toISOString();
    for (const { reviewId, patch } of changes) {
      const r = (s.level2Reviews ?? []).find((x) => x.reviewId === reviewId); if (!r) continue;
      Object.assign(r, patch, { reviewId: r.reviewId, level1Code: r.level1Code, reviewerEmail: r.reviewerEmail, updatedAt: patch.updatedAt ?? at }); out.push({ ...r });
    }
    await save(s); return out;
  });
  getConfiguration = () => serial(async () => (await load()).configuration ?? []);
  appendConfiguration = (row: ConfigRow) => serial(async () => { const s = await load(); (s.configuration ??= []).push(row); await save(s); });
  getLevel2Invites = () => serial(async () => (await load()).level2Invites ?? []);
  addLevel2Invites = (rows: Level2Invite[]) => serial(async () => { const s = await load(); (s.level2Invites ??= []).push(...rows); await save(s); });
  getLevel2Applications = () => serial(async () => (await load()).level2 ?? []);
  createLevel2Application = (a: Level2Application) => serial(async () => {
    const s = await load(); s.level2 ??= [];
    if (s.level2.some((x) => x.level1Code === a.level1Code)) throw new Error("DUPLICATE_LEVEL2");
    s.level2.push(a); await save(s);
  });
}
