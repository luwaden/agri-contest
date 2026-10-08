/**
 * Small key-value layer. Uses Upstash Redis (REST) when configured, and an in-memory map otherwise
 * (local development, tests, or if Redis is briefly unreachable). Nothing here is required for the site to work:
 * Redis makes it faster and correct across Vercel's many short-lived server instances.
 *
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (Vercel's Upstash integration names them KV_REST_API_URL / KV_REST_API_TOKEN; both work)
 */
const url = () => (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/$/, "");
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
export const redisConfigured = () => Boolean(url() && token());

type Arg = string | number;
async function run(cmd: Arg[]): Promise<unknown> {
  const res = await fetch(url(), {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(2500),
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new Error(`Redis ${cmd[0]} failed: ${body.error ?? res.status}`);
  return body.result;
}

// ── in-memory fallback ──
const mem = new Map<string, { v: string; exp: number }>();
const sets = new Map<string, Set<string>>();
const alive = (k: string) => { const e = mem.get(k); if (!e) return null; if (e.exp && e.exp < Date.now()) { mem.delete(k); return null; } return e; };

let lastWarn = 0;
async function viaRedis<T>(name: string, redisFn: () => Promise<T>, memFn: () => T): Promise<T> {
  if (!redisConfigured()) return memFn();
  try { return await redisFn(); }
  catch (e) { if (Date.now() - lastWarn > 60_000) { lastWarn = Date.now(); console.error(`[kv] Redis unavailable (${name}); using in-memory fallback:`, (e as Error).message); } return memFn(); }
}

export const kv = {
  get: (k: string) => viaRedis("get", async () => (await run(["GET", k])) as string | null, () => alive(k)?.v ?? null),
  /** Returns true if the value was written (false when nx=true and the key already existed). */
  set: (k: string, v: string, o: { ex?: number; nx?: boolean } = {}) => viaRedis("set",
    async () => (await run(["SET", k, v, ...(o.ex ? ["EX", o.ex] : []), ...(o.nx ? ["NX"] : [])])) === "OK",
    () => { if (o.nx && alive(k)) return false; mem.set(k, { v, exp: o.ex ? Date.now() + o.ex * 1000 : 0 }); return true; }),
  del: (k: string) => viaRedis("del", async () => { await run(["DEL", k]); }, () => { mem.delete(k); }),
  /** Atomic counter that expires `ttlSec` after its first increment. */
  incr: (k: string, ttlSec: number) => viaRedis("incr", async () => { const n = Number(await run(["INCR", k])); if (n === 1) await run(["EXPIRE", k, ttlSec]); return n; },
    () => { const e = alive(k); const n = (e ? Number(e.v) : 0) + 1; mem.set(k, { v: String(n), exp: e?.exp || Date.now() + ttlSec * 1000 }); return n; }),
  ttl: (k: string) => viaRedis("ttl", async () => Number(await run(["TTL", k])), () => { const e = alive(k); return e?.exp ? Math.max(1, Math.ceil((e.exp - Date.now()) / 1000)) : -1; }),
  /** Set membership. sadd returns true when the member was new. */
  sadd: (k: string, m: string) => viaRedis("sadd", async () => Number(await run(["SADD", k, m])) === 1, () => { const s = sets.get(k) ?? new Set(); const had = s.has(m); s.add(m); sets.set(k, s); return !had; }),
  /** Add many members in ONE call (used to seed the e-mail index from existing rows). */
  saddMany: (k: string, ms: string[]) => viaRedis("saddMany", async () => { for (let i = 0; i < ms.length; i += 500) await run(["SADD", k, ...ms.slice(i, i + 500)]); }, () => { const s = sets.get(k) ?? new Set(); ms.forEach((m) => s.add(m)); sets.set(k, s); }),
  srem: (k: string, m: string) => viaRedis("srem", async () => { await run(["SREM", k, m]); }, () => { sets.get(k)?.delete(m); }),
  scard: (k: string) => viaRedis("scard", async () => Number(await run(["SCARD", k])), () => sets.get(k)?.size ?? 0),
  /** Sorted-set helpers (used to count live drafts that expire on their own). */
  zadd: (k: string, score: number, m: string) => viaRedis("zadd", async () => { await run(["ZADD", k, score, m]); }, () => { mem.set(`z:${k}:${m}`, { v: String(score), exp: 0 }); }),
  zcountFrom: (k: string, min: number) => viaRedis("zcount", async () => Number(await run(["ZCOUNT", k, min, "+inf"])),
    () => [...mem.entries()].filter(([key, e]) => key.startsWith(`z:${k}:`) && Number(e.v) >= min).length),
  zremBelow: (k: string, max: number) => viaRedis("zrem", async () => { await run(["ZREMRANGEBYSCORE", k, "-inf", max]); }, () => { for (const [key, e] of mem) if (key.startsWith(`z:${k}:`) && Number(e.v) < max) mem.delete(key); }),
  ping: async (): Promise<"ok" | "off" | string> => { if (!redisConfigured()) return "off"; try { await run(["PING"]); return "ok"; } catch (e) { return (e as Error).message; } },
};
