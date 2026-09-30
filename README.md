# AGRA–SMEDAN Youth in Agribusiness Innovation Contest: web platform (Batch 1)

Next.js 15 · TypeScript · Tailwind 3 · Google Sheets (swappable data layer).

## Run it
```bash
npm install
cp .env.example .env.local      # then edit (see docs/GOOGLE_SHEETS_SETUP.md)
npm run dev                     # http://localhost:3000
npm test                        # unit tests (validation, analytics, sheet mapping, deadline logic)
npm run build
```
With `DATA_BACKEND=local` (default when no Google credentials), data goes to `.data/dev-store.json`: **development only**, blocked in production.
For a UI tour without real data set `NEXT_PUBLIC_DEMO_MODE=true` (labelled banner, in-memory, impossible in production).

## Environment variables
| Variable | Purpose |
|---|---|
| `APPLICATION_OPEN_DATE`, `APPLICATION_CLOSE_DATE` | ISO 8601 with offset. Defaults: 2 Oct / 16 Oct 2026 (WAT). Read in one place, `lib/window.ts`, and enforced by the API. |
| `DATA_BACKEND` | `sheets` or `local` |
| `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Sheets access (server only) |
| `SESSION_SECRET` | ≥32 chars; signs staff session cookies |
| `ADMIN_USERS_JSON` | Staff accounts with **bcrypt hashes** (`npm run hash-password`) |
| `NEXT_PUBLIC_DEMO_MODE` | Demo data (dev only) |

## Architecture
```
config/programme.ts     all programme facts, option lists, targets, partners (edit here)
config/scoring.ts       configurable rubric (draft)
lib/validation/         one zod schema set shared by browser and server
lib/mapper.ts           form values → canonical Application (derives age, location group, rural)
lib/repository/         ApplicationRepository interface + local backend
lib/google-sheets/      client (REST + service account), schema (stable headers), Sheets backend
lib/analytics/          pure functions: filters + metrics (work with any backend)
lib/auth/               JWT cookie sessions, bcrypt users, role→permission map
app/api/                applications, draft, auth, admin
components/             ui / landing / application / dashboard / admin
```
Moving to PostgreSQL/Supabase = one new class implementing `ApplicationRepository` and a one-line change in `lib/repository/index.ts`. No UI changes.

## Roles (`lib/auth/permissions.ts`)
ADMIN: everything · COORDINATOR: view, status, analytics, reports · JUDGE: sees **no applications yet** (assignments arrive in Batch 3) · APPLICANT: no login; uses save/resume link.

See `docs/` for the Sheets setup guide and the concept-note discrepancy log.

## Photography
The site ships with original illustrated scenes so it looks finished without stock photos. To use real photography, put files in `public/images/` and set the path in `config/media.ts` (e.g. `hero: { src: "/images/hero.jpg", ... }`). Each slot swaps automatically; the hero gets a dark gradient overlay for legible text. Only use images the programme has rights to.
