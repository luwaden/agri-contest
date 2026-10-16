import "server-only";
import { sheets, sheetsConfigured } from "./client";

/**
 * NEW TABS ONLY. The AI data desk can write nowhere else.
 * - The name always starts with "AI · " and gets a time stamp, so it can never match a data tab.
 * - It refuses any name that already exists, then ADDS a tab and writes only inside that tab.
 * - There is no update, clear or delete here, and nothing else in the AI layer can write.
 */
export const OUTPUT_PREFIX = "AI · ";
const guard = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);   // text, never a formula

export const outputTabsAvailable = () => sheetsConfigured() && (process.env.DATA_BACKEND || "sheets") === "sheets";

export function outputTabName(title: string, at = new Date()): string {
  const clean = title.replace(/[[\]*?/\\:'"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Results";
  const stamp = at.toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
  return `${OUTPUT_PREFIX}${clean} · ${stamp}`;
}

export async function createOutputTab(title: string, header: string[], rows: string[][]): Promise<{ tab: string; url: string }> {
  if (!outputTabsAvailable()) throw new Error("New tabs need the Google Sheets connection (DATA_BACKEND=sheets).");
  const existing = new Set((await sheets.meta()).sheets.map((s) => s.properties.title));
  let tab = outputTabName(title);
  for (let i = 2; existing.has(tab); i++) tab = `${outputTabName(title)} (${i})`;
  if (!tab.startsWith(OUTPUT_PREFIX) || existing.has(tab)) throw new Error("Refusing to write to an existing tab.");
  const res = await sheets.batchUpdate([{ addSheet: { properties: { title: tab, gridProperties: { rowCount: rows.length + 1, columnCount: Math.max(1, header.length), frozenRowCount: 1 } } } }]);
  const sheetId = res?.replies?.[0]?.addSheet?.properties?.sheetId;
  const all = [header, ...rows].map((r) => r.map((c) => guard(String(c ?? "")).slice(0, 49_000)));
  const q = `'${tab.replace(/'/g, "''")}'`;
  for (let i = 0; i < all.length; i += 5000) await sheets.writeRange(`${q}!A${i + 1}`, all.slice(i, i + 5000));
  return { tab, url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit${sheetId != null ? `#gid=${sheetId}` : ""}` };
}
