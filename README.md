# AGRA–SMEDAN Youth Agri-Innovation Contest: web platform

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

## Brand
See `docs/BRAND_NOTES.md`. Logos and colours: `config/brand.ts`. Fonts: `public/fonts/README.md`.


## Documentation
| File | Contents |
|---|---|
| `docs/GO_LIVE_GOOGLE_SHEETS.md` | **Start here to go live**: Apps Script (fastest) or service account |
| `apps-script/Code.gs` | The script that goes inside the Google Sheet (regenerate with `npm run build:appsscript`) |
| `docs/GOOGLE_SHEETS_SETUP.md` | Create the sheet and credentials; `npm run setup:sheets` (also creates the **Mentors** tab) |
| `docs/GOOGLE_SCRIPT.md` | Optional Apps Script mirror |
| `docs/CLOUDINARY.md` | Folder structure, private files, validation |
| `docs/AI_ARCHITECTURE.md` | How AI is connected without database access |
| `docs/DEPLOYMENT.md` | Local and Render deployment; preparing for Express |
| `docs/SECURITY_AUDIT.md` | Findings and open items |
| `docs/DISCREPANCIES.md` | Concept note vs brief |

## Design system
Tokens are in `tailwind.config.ts` (primary `#005937`, yellow `#EEFF00`, light green `#62FF50`, blue `#0872B9`). Card components: `components/ui/cards.tsx`. Partner logos are configured in `config/programme.ts`; the files are in `public/partners`. Photography slots: `config/media.ts`.

## Public positioning vs admin analytics
The public site presents a Nigeria-wide programme and states no quotas. Focal-state definitions, internal targets and geopolitical zones live only in `config/admin.ts` and the admin area. A test fails if public code mentions them.
