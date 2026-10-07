import "server-only";
import type { Application, ApplicationStatus } from "@/types/application";
import type { ApplicationRepository, AuditEvent, DraftRecord } from "@/lib/repository/types";
import { sheets as restTransport } from "./client";
import type { SheetTransport } from "./transport";
import { HEADERS, SHEETS, applicationToRow, rowToApplication } from "./schema";
import { mentorToRow, rowToMentor } from "./mentorSchema";
import type { MentorApplication, MentorStatus } from "@/types/mentor";

/** Google Sheets implementation of ApplicationRepository. */
export class SheetsRepository implements ApplicationRepository {
  readonly kind = "sheets" as const;
  constructor(private readonly sheets: SheetTransport = restTransport) {}

  private async rows() {
    const all = await this.sheets.read(SHEETS.applications);
    return all.slice(1); // row 1 = headers
  }

  private async findRow(id: string): Promise<{ rowNumber: number; row: string[] } | null> {
    const rows = await this.rows();
    const i = rows.findIndex((r) => r[0] === id);
    return i === -1 ? null : { rowNumber: i + 2, row: rows[i] };
  }

  async createApplication(app: Application) {
    if (await this.findRow(app.applicationId)) throw new Error("DUPLICATE_ID");
    await this.sheets.append(SHEETS.applications, applicationToRow(app));
  }

  async getApplications() {
    return (await this.rows()).filter((r) => r[0]).map(rowToApplication);
  }

  async getApplicationById(id: string) {
    const f = await this.findRow(id);
    return f ? rowToApplication(f.row) : null;
  }

  async updateApplication(app: Application) {
    const f = await this.findRow(app.applicationId);
    if (!f) throw new Error("NOT_FOUND");
    await this.sheets.updateRow(SHEETS.applications, f.rowNumber, applicationToRow({ ...app, metadata: { ...app.metadata, updatedAt: new Date().toISOString() } }));
  }

  async updateStatus(id: string, status: ApplicationStatus, actor: string) {
    const app = await this.getApplicationById(id);
    if (!app) return null;
    const previous = app.submissionStatus;
    const next = { ...app, submissionStatus: status };
    await this.updateApplication(next);
    await this.logEvent({ at: new Date().toISOString(), applicationId: id, actor, action: "STATUS_CHANGED", detail: `${previous} → ${status}` });
    return next;
  }

  async saveDraft(d: DraftRecord) {
    const rows = (await this.sheets.read(SHEETS.drafts)).slice(1);
    const i = rows.findIndex((r) => r[0] === d.tokenHash);
    const row = [d.tokenHash, d.email, d.updatedAt, String(d.stage), JSON.stringify(d.values)];
    if (i === -1) await this.sheets.append(SHEETS.drafts, row);
    else await this.sheets.updateRow(SHEETS.drafts, i + 2, row);
  }

  async getDraft(tokenHash: string) {
    const r = (await this.sheets.read(SHEETS.drafts)).slice(1).find((x) => x[0] === tokenHash);
    if (!r) return null;
    try { return { tokenHash: r[0], email: r[1], updatedAt: r[2], stage: Number(r[3]) || 0, values: JSON.parse(r[4] || "{}") }; }
    catch { return null; }
  }

  async deleteDraft(tokenHash: string) {
    const rows = (await this.sheets.read(SHEETS.drafts)).slice(1);
    const i = rows.findIndex((r) => r[0] === tokenHash);
    if (i !== -1) await this.sheets.clearRow(SHEETS.drafts, i + 2, HEADERS[SHEETS.drafts].length);
  }

  async createMentor(m: MentorApplication) {
    if ((await this.getMentorById(m.mentorId))) throw new Error("DUPLICATE_ID");
    await this.sheets.append(SHEETS.mentors, mentorToRow(m));
  }
  async getMentors() { return (await this.sheets.read(SHEETS.mentors)).slice(1).filter((r) => r[0]).map(rowToMentor); }
  async getMentorById(id: string) { return (await this.getMentors()).find((m) => m.mentorId === id) ?? null; }
  async updateMentorStatus(id: string, status: MentorStatus, actor: string) {
    const rows = (await this.sheets.read(SHEETS.mentors)).slice(1); const i = rows.findIndex((r) => r[0] === id);
    if (i === -1) return null;
    const m = rowToMentor(rows[i]); const prev = m.status; const next = { ...m, status, updatedAt: new Date().toISOString() };
    await this.sheets.updateRow(SHEETS.mentors, i + 2, mentorToRow(next));
    await this.logEvent({ at: next.updatedAt, applicationId: id, actor, action: "MENTOR_STATUS_CHANGED", detail: `${prev} → ${status}` });
    return next;
  }
  async getEvents(limit = 200) {
    return (await this.sheets.read(SHEETS.events)).slice(1).filter((r) => r[0]).slice(-limit).reverse()
      .map((r) => ({ at: r[0], applicationId: r[1], actor: r[2], action: r[3], detail: r[4] ?? "" }));
  }

  async countDrafts() {
    return (await this.sheets.read(SHEETS.drafts)).slice(1).filter((r) => r[0]).length;
  }

  async logEvent(e: AuditEvent) {
    await this.sheets.append(SHEETS.events, [e.at, e.applicationId, e.actor, e.action, e.detail]);
  }
}
