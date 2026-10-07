import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SCRIPT = path.resolve(process.cwd(), "apps-script/Code.gs");   // resolved at import, before any test changes directory

/** Minimal imitation of the Apps Script / Google Sheets objects used by apps-script/Code.gs. */
class FakeSheet {
  grid: string[][] = []; fmt: boolean[][] = [];
  constructor(public name: string) {}
  getLastRow() { let n = 0; this.grid.forEach((r, i) => { if (r.some((c) => c !== "")) n = i + 1; }); return n; }
  private width() { return Math.max(0, ...this.grid.map((r) => r.length)); }
  getRange(r: number, c: number, nr: number, nc: number) {
    const sheet = this;
    return {
      setNumberFormat(f: string) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { (sheet.fmt[r - 1 + i] ??= [])[c - 1 + j] = f === "@"; } return this; },
      setValues(v: unknown[][]) {
        for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
          let s = String(v[i][j] ?? "");
          // What real Sheets does to cells that are NOT plain-text formatted:
          if (!sheet.fmt[r - 1 + i]?.[c - 1 + j]) {
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) s = s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);   // date parsed and re-displayed
            else if (/^\+?\d{6,}$/.test(s)) s = String(Number(s));                                              // phone number becomes a number
            else if (s.startsWith("=")) s = "#ERROR!";                                                            // formula evaluated
          }
          ((sheet.grid[r - 1 + i] ??= [])[c - 1 + j] = s);
        }
        return this;
      },
      clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (sheet.grid[r - 1 + i]) sheet.grid[r - 1 + i][c - 1 + j] = ""; return this; },
      getDisplayValues() { const w = sheet.width(); return Array.from({ length: nr }, (_, i) => Array.from({ length: Math.max(nc, w) }, (_, j) => sheet.grid[r - 1 + i]?.[j] ?? "")); },
      setFontWeight() { return this; },
    };
  }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.width()); }
  setFrozenRows() {}
}

export function loadAppsScript(secret = "test-secret") {
  const sheets: FakeSheet[] = [new FakeSheet("Sheet1")];
  const ss = {
    getSheetByName: (n: string) => sheets.find((s) => s.name === n) ?? null,
    insertSheet: (n: string) => { const s = new FakeSheet(n); sheets.push(s); return s; },
    getSheets: () => sheets, deleteSheet: (s: FakeSheet) => { sheets.splice(sheets.indexOf(s), 1); },
  };
  const out = (s: string) => ({ getContent: () => s, setMimeType() { return this; } });
  const sandbox: any = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => (k === "SECRET" ? secret : null) }) },
    ContentService: { createTextOutput: out, MimeType: { JSON: "json" } },
  };
  vm.runInNewContext(readFileSync(SCRIPT, "utf8"), sandbox);
  return { sandbox, ss, post: (body: unknown): any => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()) };
}
