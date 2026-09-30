import "server-only";
import { GoogleAuth } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export function sheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

let auth: GoogleAuth | null = null;
function getAuth() {
  if (!sheetsConfigured()) throw new Error("Google Sheets is not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.");
  auth ??= new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // .env files store newlines as the two characters \n
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    },
    scopes: [SCOPE],
  });
  return auth;
}

async function call<T>(path: string, method: "GET" | "POST" | "PUT", data?: unknown, params?: Record<string, string>): Promise<T> {
  const client = await getAuth().getClient();
  const url = `${BASE}/${process.env.GOOGLE_SHEET_ID}${path}`;
  const res = await client.request<T>({ url, method, data, params, retry: true });
  return res.data;
}

const enc = encodeURIComponent;

export const sheets = {
  async read(sheet: string): Promise<string[][]> {
    const r = await call<{ values?: string[][] }>(`/values/${enc(sheet)}`, "GET", undefined, { majorDimension: "ROWS" });
    return r.values ?? [];
  },
  async append(sheet: string, row: string[]) {
    await call(`/values/${enc(sheet)}!A1:append`, "POST", { values: [row] }, { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" });
  },
  async updateRow(sheet: string, rowNumber: number, row: string[]) {
    await call(`/values/${enc(`${sheet}!A${rowNumber}`)}`, "PUT", { values: [row] }, { valueInputOption: "RAW" });
  },
  async clearRow(sheet: string, rowNumber: number, width: number) {
    await call(`/values/${enc(`${sheet}!A${rowNumber}:${width > 26 ? "ZZ" : "Z"}${rowNumber}`)}:clear`, "POST", {});
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
