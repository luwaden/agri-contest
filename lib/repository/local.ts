import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Application, ApplicationStatus } from "@/types/application";
import type { ApplicationRepository, AuditEvent, DraftRecord } from "./types";

interface Store { applications: Application[]; drafts: DraftRecord[]; events: AuditEvent[] }
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
  countDrafts = () => serial(async () => (await load()).drafts.length);
  logEvent = (e: AuditEvent) => serial(async () => { const s = await load(); s.events.push(e); await save(s); });
}
