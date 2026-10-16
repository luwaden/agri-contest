/**
 * The four sheet operations the repository needs. Two implementations exist:
 *   - REST + service account (lib/google-sheets/client.ts)      DATA_BACKEND=sheets
 *   - Apps Script web app inside the sheet (appsScript.ts)       DATA_BACKEND=appsscript
 * Row numbers are 1-based sheet rows (row 1 = headers).
 */
export interface SheetTransport {
  read(sheet: string): Promise<string[][]>;
  append(sheet: string, row: string[]): Promise<void>;
  updateRow(sheet: string, rowNumber: number, row: string[]): Promise<void>;
  clearRow(sheet: string, rowNumber: number, width: number): Promise<void>;
  /** Optional: many rows in ONE request (Google allows about 60 writes a minute). Falls back to append() one by one. */
  appendMany?(sheet: string, rows: string[][]): Promise<void>;
  /** Optional: rewrite many rows in ONE request. Falls back to updateRow() one by one. */
  updateRows?(sheet: string, rows: Array<{ rowNumber: number; row: string[] }>): Promise<void>;
}
