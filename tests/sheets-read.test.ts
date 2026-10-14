import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readInChunks } from "../lib/google-sheets/chunks";

// Own process: throw-away local store, no Google calls.
process.chdir(mkdtempSync(path.join(tmpdir(), "sheets-read-test-")));
Object.assign(process.env, { DATA_BACKEND: "local", ADMIN_CACHE_SECONDS: "15" });
delete process.env.NEXT_PUBLIC_DEMO_MODE;

/** Imitates values.get on a range: trailing blank rows are left out, blank rows inside the range come back as []. */
function fakeRange(sheet: string[][]) {
  const calls: string[] = [];
  const fetch = async (first: number, last: number) => {
    calls.push(`${first}:${last}`);
    const slice = sheet.slice(first - 1, last);
    while (slice.length && !slice[slice.length - 1].length) slice.pop();
    return slice.map((r) => [...r]);
  };
  return { fetch, calls };
}
const grid = (n: number, blank: number[] = []) => Array.from({ length: n }, (_, i) => (blank.includes(i + 1) ? [] : [`row${i + 1}`]));
const trimEnd = (rows: string[][]) => { const r = [...rows]; while (r.length && !r[r.length - 1].length) r.pop(); return r; };

test("sliced read returns exactly what one whole-tab read returns", async () => {
  const sheet = grid(6238);
  const { fetch, calls } = fakeRange(sheet);
  const rows = await readInChunks(7000, 1000, fetch);
  assert.deepEqual(rows, sheet);
  assert.equal(calls.length, 7);
  assert.deepEqual(calls.slice(0, 2), ["1:1000", "1001:2000"]);
});

test("blank rows at the end of a slice keep their place, so row numbers never shift", async () => {
  const sheet = grid(2500, [998, 999, 1000, 1500]);
  const rows = await readInChunks(3000, 1000, fakeRange(sheet).fetch);
  assert.equal(rows.length, 2500);
  assert.deepEqual(rows[999], []);               // sheet row 1000 is blank
  assert.deepEqual(rows[1000], ["row1001"]);     // and row 1001 is still at index 1000
  assert.deepEqual(rows, trimEnd(sheet));
});

test("a whole blank slice in the middle is padded; trailing blank slices are dropped", async () => {
  const blanks = Array.from({ length: 1000 }, (_, i) => 1001 + i);
  const sheet = [...grid(3000, blanks), [], []];
  const rows = await readInChunks(5000, 1000, fakeRange(sheet).fetch);
  assert.equal(rows.length, 3000);
  assert.deepEqual(rows[2000], ["row2001"]);
});

test("small tabs and empty tabs", async () => {
  assert.deepEqual(await readInChunks(1000, 1000, fakeRange(grid(5)).fetch), grid(5));
  assert.deepEqual(await readInChunks(1000, 1000, fakeRange([]).fetch), []);
});

test("screens loading at the same moment share one applications download; a failed refresh falls back to the recent copy", async () => {
  const { getRepository } = await import("../lib/repository");
  const { getAllApplications, invalidateAdminCache } = await import("../lib/services/analyticsService");
  const repo = getRepository();
  let downloads = 0; let fail = false;
  repo.getApplications = async () => { downloads++; await new Promise((r) => setTimeout(r, 30)); if (fail) throw new Error("ETIMEDOUT"); return []; };

  await Promise.all([getAllApplications(), getAllApplications(), getAllApplications()]);
  assert.equal(downloads, 1);

  await getAllApplications();                     // still fresh: no new download
  assert.equal(downloads, 1);

  fail = true;
  const realNow = Date.now; Date.now = () => realNow() + 20_000;   // cache is 20 s old: past TTL, within the 10-minute fallback
  const warn = console.warn; const warnings: string[] = []; console.warn = (m: string) => { warnings.push(m); };
  try {
    assert.deepEqual(await getAllApplications(), []);
    assert.equal(downloads, 2);
    assert.match(warnings[0] ?? "", /did not answer/);
    invalidateAdminCache();                        // no copy at all: the error must reach the caller
    await assert.rejects(getAllApplications(), /ETIMEDOUT/);
  } finally { Date.now = realNow; console.warn = warn; }
});
