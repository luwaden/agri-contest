import type { SheetTransport } from "./transport";

export const appsScriptConfigured = () => Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SECRET);

/**
 * Talks to the Apps Script web app that lives inside the Google Sheet (apps-script/Code.gs).
 * No Google Cloud project or key file is needed: the script runs as the sheet owner, and a shared secret
 * (stored in the script's own properties) is the lock.
 */
export class AppsScriptTransport implements SheetTransport {
  private async call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const url = process.env.APPS_SCRIPT_URL, secret = process.env.APPS_SCRIPT_SECRET;
    if (!url || !secret) throw new Error("Apps Script is not configured. Set APPS_SCRIPT_URL and APPS_SCRIPT_SECRET.");
    const res = await fetch(url, {
      method: "POST", redirect: "follow", signal: AbortSignal.timeout(28_000),
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // text/plain: Apps Script web apps cannot answer CORS preflights
      body: JSON.stringify({ secret, action, ...payload }),
    });
    const text = await res.text();
    let body: { error?: string } & Record<string, unknown>;
    try { body = JSON.parse(text); } catch { throw new Error(`Apps Script returned a non-JSON reply (HTTP ${res.status}). Check the web app is deployed with access "Anyone".`); }
    if (!res.ok || body.error) throw new Error(`Apps Script error: ${body.error ?? res.status}`);
    return body as T;
  }
  async read(sheet: string) { return (await this.call<{ rows: string[][] }>("read", { sheet })).rows; }
  async append(sheet: string, row: string[]) { await this.call("append", { sheet, row }); }
  async updateRow(sheet: string, rowNumber: number, row: string[]) { await this.call("updateRow", { sheet, rowNumber, row }); }
  async clearRow(sheet: string, rowNumber: number, width: number) { await this.call("clearRow", { sheet, rowNumber, width }); }
}
