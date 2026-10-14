/**
 * Times each step of talking to Google Sheets from THIS computer, to find where a slow or stuck page waits.
 * Read-only: nothing is written to the sheet. Run: npm run check:speed
 */
import "./loadEnv";   // side-effect import: loads .env / .env.local exactly like Next.js. Must stay FIRST
import { lookup } from "node:dns/promises";
import { connect } from "node:net";
import { GoogleAuth } from "google-auth-library";
import { normalizePrivateKey } from "../lib/google-sheets/key";

const HOST = "sheets.googleapis.com";
const LIMIT_MS = 60_000;
const secs = (t: number) => `${((Date.now() - t) / 1000).toFixed(1)} s`;

async function step<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  const t = Date.now();
  try {
    const out = await Promise.race([run(), new Promise<never>((_, no) => setTimeout(() => no(new Error(`no answer after ${LIMIT_MS / 1000} s`)), LIMIT_MS))]);
    console.log(`  ✔ ${label}: ${secs(t)}`); return out;
  } catch (e) { console.log(`  ✘ ${label}: failed after ${secs(t)}: ${String((e as Error)?.message ?? e).slice(0, 200)}`); return null; }
}

const tcp = (address: string, family: 4 | 6) => new Promise<void>((ok, no) => {
  const s = connect({ host: address, port: 443, family, timeout: 15_000 });
  s.once("connect", () => { s.destroy(); ok(); });
  s.once("timeout", () => { s.destroy(); no(new Error("timed out after 15 s")); });
  s.once("error", (e) => no(e));
});

async function main() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) { console.log("Google settings are missing. Run npm run check:google first."); process.exit(1); }
  console.log(`Checking the connection from this computer to Google Sheets (each step gives up after ${LIMIT_MS / 1000} s)\n`);

  console.log("1. Finding Google's server");
  const addrs = (await step(`look up ${HOST}`, () => lookup(HOST, { all: true }))) ?? [];
  const v4 = addrs.find((a) => a.family === 4)?.address, v6 = addrs.find((a) => a.family === 6)?.address;
  console.log(`     addresses: ${addrs.length ? addrs.map((a) => a.address).join(", ") : "none"}`);

  console.log("2. Connecting");
  if (v4) await step(`connect over IPv4 (${v4})`, () => tcp(v4, 4));
  if (v6) await step(`connect over IPv6 (${v6})`, () => tcp(v6, 6));

  console.log("3. Signing in with the service account");
  const auth = new GoogleAuth({ credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY) }, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const token = await step("get an access token", async () => (await (await auth.getClient()).getAccessToken()).token);
  if (!token) { console.log("\nStopped: could not sign in. Steps 1–2 above show whether Google can be reached at all."); return; }

  const get = async (url: string) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Accept-Encoding": "gzip", "User-Agent": "agri-contest (gzip)" }, signal: AbortSignal.timeout(LIMIT_MS) });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 150)}`);
    return { text, gzip: res.headers.get("content-encoding") === "gzip" };
  };
  const base = `https://${HOST}/v4/spreadsheets/${id}`;

  console.log("4. Reading");
  const meta = await step("read the list of tabs", () => get(`${base}?fields=sheets.properties(title,gridProperties.rowCount)`));
  const rows = meta ? JSON.parse(meta.text).sheets?.find((s: any) => s.properties?.title === "Applications")?.properties?.gridProperties?.rowCount : null;
  if (meta) console.log(`     Applications tab has ${rows ?? "?"} grid rows`);
  const t = Date.now();
  const slice = await step("read rows 1–1000 of Applications", () => get(`${base}/values/${encodeURIComponent("'Applications'!A1:ZZ1000")}?majorDimension=ROWS`));
  if (slice) {
    const mb = Buffer.byteLength(slice.text) / 1e6, s = (Date.now() - t) / 1000;
    console.log(`     ${mb.toFixed(1)} MB of data, compressed by Google: ${slice.gzip ? "yes" : "no"}`);
    if (rows) console.log(`     → the whole tab is about ${Math.ceil(rows / 1000)} slices like this, so roughly ${Math.round(s * Math.ceil(rows / 1000))} s per full load from this computer`);
  }
  console.log("\nSend the lines above to whoever is helping you. Nothing was written to the sheet.");
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
