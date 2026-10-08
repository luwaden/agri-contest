import { getRepository } from "@/lib/repository";
import { kv, redisConfigured } from "@/lib/kv";
import type { DraftRecord } from "@/lib/repository/types";

const TTL_DAYS = 30, TTL = TTL_DAYS * 86400;
const key = (hash: string) => `draft:${hash}`;
const INDEX = "drafts:index";

/**
 * Applicants' saved progress. With Redis: one fast write, auto-expires after 30 days, and never touches the Google
 * Sheets quota (about 60 reads/min), which is what typing-heavy traffic exhausts. Without Redis: the Drafts tab, as before.
 */
export async function saveDraft(d: DraftRecord): Promise<void> {
  if (redisConfigured()) {
    try {
      await kv.set(key(d.tokenHash), JSON.stringify(d), { ex: TTL });
      await kv.zadd(INDEX, Date.now() + TTL * 1000, d.tokenHash);
      return;
    } catch (e) { console.error("[drafts] Redis save failed, using the sheet:", (e as Error).message); }
  }
  await getRepository().saveDraft(d);
}

export async function getDraft(hash: string): Promise<DraftRecord | null> {
  if (redisConfigured()) {
    const raw = await kv.get(key(hash));
    if (raw) { try { return JSON.parse(raw) as DraftRecord; } catch { /* fall through */ } }
  }
  return getRepository().getDraft(hash);
}

export async function deleteDraft(hash: string): Promise<void> {
  if (redisConfigured()) { await kv.del(key(hash)); await kv.zremBelow(INDEX, 0); }
  await getRepository().deleteDraft(hash).catch(() => undefined);
}

export async function countDrafts(): Promise<number> {
  if (redisConfigured()) {
    await kv.zremBelow(INDEX, Date.now());
    return kv.zcountFrom(INDEX, Date.now());
  }
  return getRepository().countDrafts();
}
