# PROJECT_STATUS.md: handover (updated 23 Oct 2026, 23:30 WAT; replaces the 13 Oct version)

> **For the next Claude conversation:** the user's GitHub repo on their Windows PC (`C:\Users\ayode\Downloads\agra-contest-current\agri-contest-12-01`, GitHub `luwaden/agri-contest`, branch `main`) is the source of truth. The latest code from this chat is the cumulative zip **`agri-update-9.zip` (86 files, version `2026.10.23`)**. It contains every change since the 13 Oct `agri-contest-platform_5.zip`. Whether the user has applied it is **[UNKNOWN]**: ask. **Read files before changing them.** The user wants **changed files only** (a small zip plus exact `git add` paths), and **never** a replacement for `config/programme.ts` (give line edits). Keep replies short and plain; the user is not a developer by default. Follow the user's Prisma note: this project does **not** use Prisma.
>
> **Legend:** **[VERIFIED]** tested by me (tests, build, browser run, or output I saw) · **[USER-REPORTED]** · **[ASSUMED]** · **[NOT BUILT]**.

---

## 1. Purpose, stack, hosting
- Website and staff tools for the **AGRA–SMEDAN Youth Agri-Innovation Contest** (delivered by Plus Incubation Hub Nigeria Ltd). Young Nigerians aged 18–35 applied (Level 1, **closed 16 Oct 2026 23:59 WAT**; about 6,238 applications). Grand finale Thu 29 Oct; showcase 8–10 Nov.
- **Stack:** Next.js 15.5 (App Router), React 19, TypeScript, Tailwind, zod, bcryptjs, google-auth-library (Sheets REST), nodemailer 10.0.10 pinned (Gmail SMTP) or Resend, Cloudinary (uploads), optional Upstash Redis, optional AI (OpenAI or Claude). Tests: `node:test` via `tsx --conditions=react-server`.
- **Data store:** ONE Google Sheet ("AGRA-SMEDAN Applications"). No SQL database.
- **Hosting:** the user **deleted the Vercel project** (13 Oct) and runs the app **locally** (`npm run build && npm start`). The new host is **not chosen yet**. When it is: set every env var (§7), `NEXT_PUBLIC_SITE_URL` = the new URL, build `npm run build`, start `npm start`.
- **Architecture:** thin `app/api/**` routes → `lib/services/**` → the repository interface `lib/repository/types.ts` (implementations: `lib/google-sheets/applications.ts` (Sheets REST or Apps Script) and `lib/repository/local.ts` (JSON file, development only)). Role checks: `lib/auth/permissions.ts` (server-side on every page and route).

## 2. Google Sheet tabs (append-only: never reorder or rename columns; the app writes by column position)
| Tab | Notes |
|---|---|
| Applications | 74 columns, Level 1 applications |
| Drafts, Application Events (audit log), Mentors (panel applications), Admin Users (staff), Judges (legacy), Configuration | unchanged |
| Panel Reviews | 20 columns; **col 20 `decision` (PASS) added 16 Oct** |
| **Email Campaigns**, **Email Log** | NEW 19 Oct (Messages) |
| **Level 2 Applications**, **Level 2 Invites** | NEW 23 Oct (Level 2) |
| "AI · …" tabs | created only by the AI data desk; safe to delete |

**Migration for agri-update-9:** `npm run preflight` (backup + check) → `npm run setup:sheets` (adds only missing tabs and columns; **never** `--force`). Whether the user has run it is **[UNKNOWN]**.

## 3. What was built in this chat (all in agri-update-9.zip) [VERIFIED by tests and local browser runs; NOT run against the live sheet]
1. **Sheets speed and quota (13 & 16 Oct).** The 129 s ETIMEDOUT and `SHEET_QUOTA` (60 reads/min) errors were fixed:
   - gzip; 3,000-row slices (`lib/google-sheets/chunks.ts`); tab row counts remembered for 60 s.
   - One shared copy of each tab for 20 s (`SHEETS_REUSE_SECONDS`) and of parsed applications for 60 s (`ADMIN_CACHE_SECONDS`), kept on `globalThis`. Every write clears the copy before and after.
   - The staff list comes from its 30 s cache; a 429 waits 15 s and retries up to 3 times; a stale copy up to 10 min old is used if Google fails.
   - Write ranges quote tab names; `updateRows` batches row updates into one request. The "Maximum call stack at Set.has" error was a dev-mode React issue: use `npm start`.
2. **Screening pipeline** (Admin → Screening, `lib/screening/index.ts`, `config/screening.ts`):
   - eligibility rules (age, Nigerian, declaration, Nigerian state, minimum words, duplicates);
   - an automatic **pre-score** from the answers on the judges' 5 criteria (code, not AI; guidance only);
   - top 1,300 CSV → batch of 500 with a fair spread → shared between 10 reviewers;
   - reviewers **Pass** up to 15 (`SCREENING_PASS_PER_REVIEWER`) and do NOT see the pre-score;
   - an easy **Move** board (tick → person or "share evenly"; passed/scored work never moves);
   - send passed applications to judges → judges score → top 30 CSV.
3. **Quick requests** (top of Screening; `lib/screening/customList.ts`, `balanced.ts`, `lib/services/screeningAssistant.ts`). Plain-English, works without AI:
   - lists with exact focal/other shares and women/PWD/rural minimums, optionally "in the first N", with editable settings and a CSV;
   - **balanced per-state selection** (e.g. "180 people, 60 each from Kaduna, Niger, Nasarawa, 20% women, 10% PWD, mixed ages, LGA spread", ~3 s);
   - counts ("how many women in the batch"); proposed moves and "send to judges", which run only on **Confirm**.
4. **AI data desk** (Admin → AI data desk, ADMIN only, `lib/services/aiDataDesk.ts`):
   - the AI READS all data via server tools: search, count, get_application, `balanced_sheet`;
   - it can WRITE only **new "AI · …" tabs** plus a CSV (`lib/google-sheets/outputTabs.ts`); existing tabs are never changed (tested byte-for-byte);
   - contact details reach the AI only if `AI_FULL_DATA_ACCESS=true` (check the privacy notice and NDPA 2023 first);
   - an empty AI reply now gives a clear message (cause: reasoning models using up the reply budget); settings `OPENAI_REASONING_EFFORT` (recommend `low`) and `AI_MAX_OUTPUT_TOKENS` (e.g. 8000).
5. **Messages** (Admin → Messages, ADMIN only, `lib/services/emailCampaignService.ts`). Email from the configured sender (`GMAIL_USER` = youthagriinnovate@gmail.com, or Resend):
   - groups: passed, batch, judges, top N, a status, staff accounts, panel applications, or **any pasted email addresses** with names, mixed with applicant codes;
   - fill-ins `{first_name}` etc.; preview, then test to yourself, then batches of 20 from the open page (pause, continue, cancel);
   - at most 2,000 per message; daily cap `EMAIL_DAILY_LIMIT` (450 for Gmail); never twice to the same person; all logged.
6. **Level 2 application** (hidden page **`/level-2`**; Admin → Level 2; `lib/services/level2Service.ts`, `config/level2.ts`, `lib/validation/level2.ts`, `lib/google-sheets/level2Schema.ts`):
   - access needs a Level 1 code + the matching Level 1 email + the code on the **invite list** (admin pastes codes); then a signed 3 h pass;
   - answers known from Level 1 are pre-filled; **one submission per code**; repeated questions removed (Name = contact person; State once; rural/urban once);
   - follow-up questions only when needed; ≥1 supporting document; CAC upload if CAC = YES; uploads go to `programme/level-2/<code>`;
   - optional `LEVEL2_CLOSE_DATE`; confirmation email on submit. More questions are "still to come": append them at the END of `LEVEL2_COLUMNS`.

## 4. Roles
ADMIN: everything (incl. Messages `email:send`, AI data desk `ai:data`). COORDINATOR: everything except staff, settings, Messages and the AI desk. JUDGE / REVIEWER: only their assigned work. Applicants and panel applicants have no accounts.

## 5. Open issues and decisions waiting for the user
- **Not yet confirmed by the user:** that agri-update-9 is applied, `setup:sheets` has been run, and it works on the live sheet. The 16 Oct **500 error when assigning** never got a server log; screens now show `code` + `ref`, so ask for the `[api] ref=… code=…` line if it recurs.
- **Hosting:** new host not chosen.
- **Database:** I recommended moving to **PostgreSQL** (Neon or Supabase) with the Sheet as a mirror, or as cheaper interim steps (read only needed columns; remember row numbers). The user has **not chosen**. [NOT BUILT]
- **Level 2:** invite-only is my default; the user may want "any Level 1 applicant with the link". Invites cannot be removed in the UI.
- **Email:** Gmail mail lands in Spam [USER-REPORTED]; the real fix is their own domain + Resend. About 500/day Gmail limit.
- Possible later features: Redis in production, self-service password reset, moderation workflow, Level 2 review/scoring.

## 6. Rules to keep
No credentials in frontend code; no plaintext passwords. The AI never writes to existing data. No public 60/40 or "focal state" wording (admin-only screens are fine). Don't invent programme facts. Append-only sheet columns; preflight before any data change. `.gitignore` must exclude `.env`, `node_modules`, `backups/`; stage files by name.

## 7. Environment variables (names only)
`DATA_BACKEND`, `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `TRUST_PROXY`, `APPLICATION_OPEN_DATE`, `APPLICATION_CLOSE_DATE`, **`LEVEL2_CLOSE_DATE`**, `ADMIN_USERS_JSON`, `ADMIN_CACHE_SECONDS`, **`SHEETS_REUSE_SECONDS`**, **`SHEETS_TIMEOUT_SECONDS`**, `UPSTASH_REDIS_REST_URL`/`_TOKEN`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, **`EMAIL_DAILY_LIMIT`**, `CLOUDINARY_*`, `UPLOAD_MAX_MB`, `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, **`OPENAI_REASONING_EFFORT`**, **`AI_MAX_OUTPUT_TOKENS`**, **`AI_FULL_DATA_ACCESS`**, `AI_ALLOW_TEXT_EXCERPTS`, **`SCREENING_PASS_PER_REVIEWER`**, `APPS_SCRIPT_URL`/`_SECRET`, `HEALTH_CHECK_TOKEN`, `CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_DEMO_MODE`. (Bold = added in this chat; all documented in `.env.example`.)

## 8. Testing
`npm test` → **111 passed, 0 failed** [VERIFIED 23 Oct]; `tsc --noEmit` clean; `next build` succeeds. Test files: core, platform, repository (contract on local + fake Sheets + Apps Script, incl. reviews, email tabs, Level 2), email, judging, sheets-read, screening, screening-assistant, ai-data-desk, ai-provider, messages, level2. Test data generator: `tests/helpers/varied.ts`. Browser runs used Playwright locally on 6,238 seeded test applications (never real data).

## 9. Exact next steps
1. Ask whether `agri-update-9.zip` is applied. If not: unzip it over the repo → `npm test` → `npm run preflight` → `npm run setup:sheets` → `npm run build && npm start`.
2. Check with real data: Screening step 1 counts and the top-1,300 CSV; Quick requests for the 180 focal list; Messages test-to-self; Level 2 invite → form → submission.
3. Commit with named paths, push, and choose a host (then `check:live`).
4. Decide: PostgreSQL move vs Sheets quick wins; Level 2 access rule; email domain.

## 11. Additions 26–27 Oct 2026 (agri-update-17-all.zip = everything since GitHub main 2243297)
- **Messages attachments** (≤5 files, 10 MB total; stored on server disk `.data/files/email-attachments`; NOT possible on Vercel's read-only disk). [VERIFIED tests]
- **Level 2 uploads**: upload-first field (progress, replace/remove, photo shrink, HEIC message, error codes). Cloudinary when configured, else server disk (`stored:` refs). [VERIFIED browser]
- **Level 2 detail page** `/admin/level-2/[code]`: answers, labelled documents, Open via `/api/admin/files` (logged with the code), review result. [VERIFIED browser]
- **Admin → Settings** (ADMIN only): 10 feature switches in `config/features.ts`, stored in the existing **Configuration** tab (`feature.<key> | on/off`, newest row wins), 20 s cache, enforced on the server. [VERIFIED tests + browser]
- **Level 2 reviews**: new tab **"Level 2 Reviews"** (needs `npm run setup:sheets` once). Admin/Coordinator: `/admin/level-2/reviews` share evenly (states mixed) → move / remove / reopen, CSV. Reviewers/Judges: `/review/level-2` list and `/review/level-2/[code]` (5 questions 1–5, total /25, Recommend / Do not recommend, comment; no contact details shown). One live review per applicant. Switch `level2Scoring`. [VERIFIED tests + browser]
- [USER-REPORTED 26 Oct] Live on Vercel at www.youthagriinnovate.ng. Upload failure cause: `CLOUDINARY_CLOUD_NAME=Agra_Root` is wrong (must be the cloud name from the Cloudinary dashboard). Upstash URL in Vercel probably wrapped in quotes.
- **Staff from panel applications** (Admin → Staff): tick panel applicants, pick Reviewer/Judge, "Create accounts" → account + emailed invite link + application ACCEPTED. Password links are now SIGNED with SESSION_SECRET (no Redis needed); single use via a fingerprint of the current password; invite 7 days, reset 60 min. [VERIFIED tests + browser]
- Version 2026.10.27.2. Tests: 131 passing.
