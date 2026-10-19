import "server-only";
import { GoogleAuth } from "google-auth-library";
import { explainKeyProblem, normalizePrivateKey } from "./key";
import { readInChunks } from "./chunks";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export function sheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

let auth: GoogleAuth | null = null;
function getAuth() {
  if (!sheetsConfigured()) throw new Error("Google Sheets is not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.");
  const problem = explainKeyProblem(process.env.GOOGLE_PRIVATE_KEY);
  if (problem) throw new Error(`Google Sheets key problem: ${problem}`);
  auth ??= new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    },
    scopes: [SCOPE],
  });
  return auth;
}

/** Google only compresses responses when the User-Agent contains "gzip". Sheet text compresses several times over. */
const HEADERS = { "Accept-Encoding": "gzip", "User-Agent": "agri-contest (gzip)" };
/** Give up on one request after this long (default 90 s; SHEETS_TIMEOUT_SECONDS overrides). */
const TIMEOUT_MS = (Number(process.env.SHEETS_TIMEOUT_SECONDS) || 90) * 1000;

async function call<T>(path: string, method: "GET" | "POST" | "PUT", data?: unknown, params?: Record<string, string>): Promise<T> {
  const client = await getAuth().getClient();
  const url = `${BASE}/${process.env.GOOGLE_SHEET_ID}${path}`;
  // Google allows about 60 reads (and 60 writes) a minute. When that is used up it answers 429 and nothing was done,
  // so waiting for the minute to roll over and trying again is safe, for reads and writes alike.
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await client.request<T>({ url, method, data, params, headers: HEADERS, timeout: TIMEOUT_MS, retry: true });
      return res.data;
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 429 && attempt < QUOTA_RETRIES) {
        console.warn(`[sheets] Google's per-minute limit reached; waiting ${QUOTA_WAIT_MS / 1000} s before trying again (${attempt + 1}/${QUOTA_RETRIES})`);
        await new Promise((r) => setTimeout(r, QUOTA_WAIT_MS)); continue;
      }
      throw slimError(e, method, path);
    }
  }
}
const QUOTA_RETRIES = 3, QUOTA_WAIT_MS = 15_000;

/**
 * Google's error objects carry the whole request and response (with 6,000+ rows that is megabytes, and circular).
 * Logging one can crash the server with "Maximum call stack size exceeded". Keep only what matters.
 */
function slimError(e: unknown, method: string, path: string): Error {
  const any = e as { message?: string; code?: string | number; response?: { status?: number; data?: { error?: { message?: string; status?: string } } } };
  const status = any?.response?.status, g = any?.response?.data?.error;
  const err = new Error(`Google Sheets ${method} ${decodeURIComponent(path).slice(0, 80)} failed${status ? ` (HTTP ${status})` : ""}: ${String(g?.message ?? any?.message ?? e).slice(0, 300)}`) as Error & { code?: unknown; response?: unknown };
  err.code = any?.code; err.response = { status, data: { error: { message: g?.message, status: g?.status } } };
  return err;
}

/**
 * Several screens (and several requests in a row) read the same tab. Share one read while it runs and for 20 s after,
 * to stay well under Google's ~60 reads a minute. Every write through this app clears the copy before AND after it
 * runs, so a change is never hidden. Kept on globalThis so all parts of the app share it (also under `next dev`).
 */
type Shared = { recent: Map<string, { at: number | null; p: Promise<string[][]> }>; rows: { at: number; counts: Map<string, number> } | null };
const shared: Shared = ((globalThis as { __agraSheets?: Shared }).__agraSheets ??= { recent: new Map(), rows: null });
const recent = shared.recent;
const READ_REUSE_MS = (Number(process.env.SHEETS_REUSE_SECONDS) || 20) * 1000;
const ROWCOUNT_REUSE_MS = 60_000;
const forget = (sheet: string) => { recent.delete(sheet); shared.rows = null; };
async function writing<T>(sheet: string, run: () => Promise<T>): Promise<T> { forget(sheet); try { return await run(); } finally { forget(sheet); } }

const enc = encodeURIComponent;
const quoteTab = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

/** Tabs that grow into thousands of rows. They are read in slices; small tabs keep the single request. */
const LARGE_TABS = new Set(["Applications", "Panel Reviews", "Email Log"]);
const CHUNK_ROWS = 3000;   // with gzip a 3,000-row slice is small; fewer slices = fewer reads against the quota

async function readWhole(sheet: string): Promise<string[][]> {
  return (await call<{ values?: string[][] }>(`/values/${enc(sheet)}`, "GET", undefined, { majorDimension: "ROWS" })).values ?? [];
}

async function readLarge(sheet: string): Promise<string[][]> {
  // One small request gives the size of EVERY tab; remember it for a minute (cleared by any write).
  if (!shared.rows || Date.now() - shared.rows.at > ROWCOUNT_REUSE_MS) {
    const meta = await call<{ sheets?: Array<{ properties?: { title?: string; gridProperties?: { rowCount?: number } } }> }>(
      "", "GET", undefined, { fields: "sheets.properties(title,gridProperties.rowCount)" });
    shared.rows = { at: Date.now(), counts: new Map((meta.sheets ?? []).map((x) => [x.properties?.title ?? "", x.properties?.gridProperties?.rowCount ?? 0])) };
  }
  const rowCount = shared.rows.counts.get(sheet);
  if (!rowCount) return readWhole(sheet);   // tab missing: let the normal read raise the usual "Unable to parse range"
  const started = Date.now();
  const rows = await readInChunks(rowCount, CHUNK_ROWS, (first, last) =>
    call<{ values?: string[][] }>(`/values/${enc(`${quoteTab(sheet)}!A${first}:ZZ${last}`)}`, "GET", undefined, { majorDimension: "ROWS" }).then((r) => r.values ?? []));
  const secs = (Date.now() - started) / 1000;
  if (secs > 10) console.warn(`[sheets] reading "${sheet}" (${rows.length} rows) took ${secs.toFixed(0)} s`);
  return rows;
}

export const sheets = {
  async read(sheet: string): Promise<string[][]> {
    const hit = recent.get(sheet);
    if (hit && (hit.at === null || Date.now() - hit.at < READ_REUSE_MS)) return (await hit.p).map((r) => [...r]);
    const entry: { at: number | null; p: Promise<string[][]> } = { at: null, p: LARGE_TABS.has(sheet) ? readLarge(sheet) : readWhole(sheet) };
    recent.set(sheet, entry);
    entry.p.then(() => { entry.at = Date.now(); }, () => { if (recent.get(sheet) === entry) forget(sheet); });
    return (await entry.p).map((r) => [...r]);
  },
  async append(sheet: string, row: string[]) {
    await writing(sheet, () => call(`/values/${enc(`${quoteTab(sheet)}!A1`)}:append`, "POST", { values: [row] }, { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" }));
  },
  async appendMany(sheet: string, rows: string[][]) {
    await writing(sheet, async () => {
      for (let i = 0; i < rows.length; i += 500)
        await call(`/values/${enc(`${quoteTab(sheet)}!A1`)}:append`, "POST", { values: rows.slice(i, i + 500) }, { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" });
    });
  },
  async updateRow(sheet: string, rowNumber: number, row: string[]) {
    await writing(sheet, () => call(`/values/${enc(`${quoteTab(sheet)}!A${rowNumber}`)}`, "PUT", { values: [row] }, { valueInputOption: "RAW" }));
  },
  async updateRows(sheet: string, rows: Array<{ rowNumber: number; row: string[] }>) {
    await writing(sheet, async () => {
      for (let i = 0; i < rows.length; i += 500)
        await call("/values:batchUpdate", "POST", { valueInputOption: "RAW", data: rows.slice(i, i + 500).map((r) => ({ range: `${quoteTab(sheet)}!A${r.rowNumber}`, values: [r.row] })) });
    });
  },
  async clearRow(sheet: string, rowNumber: number, width: number) {
    await writing(sheet, () => call(`/values/${enc(`${quoteTab(sheet)}!A${rowNumber}:${width > 26 ? "ZZ" : "Z"}${rowNumber}`)}:clear`, "POST", {}));
  },
  async batchUpdate(requests: unknown[]) {
    return call<any>(":batchUpdate", "POST", { requests });
  },
  async meta() {
    return call<{ sheets: Array<{ properties: { title: string; sheetId: number } }> }>("", "GET", undefined, { fields: "sheets.properties" });
  },
  async writeRange(rangeA1: string, values: string[][], userEntered = false) {
    await call(`/values/${enc(rangeA1)}`, "PUT", { values }, { valueInputOption: userEntered ? "USER_ENTERED" : "RAW" });
  },
};
