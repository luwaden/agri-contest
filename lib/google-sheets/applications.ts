import "server-only";
import type { Application, ApplicationStatus } from "@/types/application";
import type { ApplicationRepository, AuditEvent, DraftRecord } from "@/lib/repository/types";
import { sheets } from "./client";
import { HEADERS, SHEETS, applicationToRow, rowToApplication } from "./schema";

/** Google Sheets implementation of ApplicationRepository. */
export class SheetsRepository implements ApplicationRepository {
  readonly kind = "sheets" as const;

  private async rows() {
    const all = await sheets.read(SHEETS.applications);
    return all.slice(1); // row 1 = headers
  }

  private async findRow(id: string): Promise<{ rowNumber: number; row: string[] } | null> {
    const rows = await this.rows();
    const i = rows.findIndex((r) => r[0] === id);
    return i === -1 ? null : { rowNumber: i + 2, row: rows[i] };
  }

  async createApplication(app: Application) {
    if (await this.findRow(app.applicationId)) throw new Error("DUPLICATE_ID");
    await sheets.append(SHEETS.applications, applicationToRow(app));
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
    await sheets.updateRow(SHEETS.applications, f.rowNumber, applicationToRow({ ...app, metadata: { ...app.metadata, updatedAt: new Date().toISOString() } }));
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
    const rows = (await sheets.read(SHEETS.drafts)).slice(1);
    const i = rows.findIndex((r) => r[0] === d.tokenHash);
    const row = [d.tokenHash, d.email, d.updatedAt, String(d.stage), JSON.stringify(d.values)];
    if (i === -1) await sheets.append(SHEETS.drafts, row);
    else await sheets.updateRow(SHEETS.drafts, i + 2, row);
  }

  async getDraft(tokenHash: string) {
    const r = (await sheets.read(SHEETS.drafts)).slice(1).find((x) => x[0] === tokenHash);
    if (!r) return null;
    try { return { tokenHash: r[0], email: r[1], updatedAt: r[2], stage: Number(r[3]) || 0, values: JSON.parse(r[4] || "{}") }; }
    catch { return null; }
  }

  async deleteDraft(tokenHash: string) {
    const rows = (await sheets.read(SHEETS.drafts)).slice(1);
    const i = rows.findIndex((r) => r[0] === tokenHash);
    if (i !== -1) await sheets.clearRow(SHEETS.drafts, i + 2, HEADERS[SHEETS.drafts].length);
  }

  async countDrafts() {
    return (await sheets.read(SHEETS.drafts)).slice(1).filter((r) => r[0]).length;
  }

  async logEvent(e: AuditEvent) {
    await sheets.append(SHEETS.events, [e.at, e.applicationId, e.actor, e.action, e.detail]);
  }
}
