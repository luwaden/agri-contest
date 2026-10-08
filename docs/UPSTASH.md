# Redis (Upstash): do you need it, and how to switch it on

## Do you need it? Yes, for three real reasons
1. **Rate limiting only works properly with it.** Vercel runs your site on many short-lived servers. Without Redis each server counts separately, so the "5 login attempts" and "8 submissions" limits barely work. Redis makes the count shared.
2. **Saved progress was using up Google's limit.** Every "Continue" and "Save progress" read and wrote the sheet. Google allows about **60 reads a minute**; a few dozen people typing at once can hit it, which shows up as 500 errors. With Redis, drafts live in Redis (auto-deleted after 30 days) and the sheet is used only for real submissions.
3. **One application per email, safely.** Two people (or one double-click) submitting at the same instant can both pass a "does this email exist?" check. Redis makes the check atomic. It also avoids reading the entire sheet on every submission.

Bonus: the AI assistant caches repeated public questions for an hour, so it is faster and cheaper.

**What Redis is NOT used for:** it does not replace Google Sheets. Applications are still saved in the sheet. Redis holds only temporary things (counters, drafts, the email index, cached answers). If Redis is down or not set up, the site **keeps working** (falls back to memory and the sheet); it is just slower and less strict.

## Switch it on (10 minutes, free tier is enough)
1. <https://console.upstash.com> → **Create database** → name `agri-contest` → pick the region closest to your Vercel region → Create.
2. On the database page open the **REST API** section. Copy **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`**.
3. Vercel → Settings → Environment Variables → add both (Production). *(If you add Upstash from Vercel's Marketplace instead, Vercel creates `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically: the site accepts those names too.)*
4. **Redeploy.**
5. Check `/api/health?check=store`: it should show `"redisStatus": "ok"`.

## What is stored (and for how long)
| Key | Purpose | Lifetime |
|---|---|---|
| `rl:*` | rate-limit counters | 10 to 15 minutes |
| `draft:*` | an applicant's saved progress | 30 days |
| `applicants:emails` | scrambled (hashed) emails already used, for the duplicate check | until you clear it |
| `ai:pub:*` | cached public assistant answers | 1 hour |

No raw email addresses are stored in the email index (only a one-way hash). Drafts contain what the applicant typed, so treat the Redis database as personal data and keep the token private.

## Resetting
To let a test email apply again: delete the row in the sheet **and** run `SREM applicants:emails <hash>` or simply clear the database in the Upstash console during testing (never after launch).
