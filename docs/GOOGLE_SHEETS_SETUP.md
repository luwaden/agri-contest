# Google Sheets setup (beginner-friendly)

The website stores applications in a Google Sheet. Only the server talks to Google; the browser never sees credentials.

## 1. Create the spreadsheet
1. Go to https://sheets.google.com and create a **blank spreadsheet**. Name it e.g. `AGRA-SMEDAN Contest Data`.
2. Copy the **Sheet ID** from the address bar: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

## 2. Create a service account (the app's "robot" login)
1. Open https://console.cloud.google.com and create a project (e.g. `agri-contest`).
2. **APIs & Services → Library →** search **Google Sheets API → Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.** Name it `contest-web`. Skip the optional steps.
4. Open the new service account → **Keys → Add key → Create new key → JSON.** A file downloads. Keep it private and never commit it.
5. From that JSON note two values: `client_email` and `private_key`.

## 3. Share the sheet with the service account
Open the spreadsheet → **Share** → paste the `client_email` → give **Editor** access → uncheck "Notify" → Share.

## 4. Configure the app
Copy `.env.example` to `.env.local` and fill in:
```
DATA_BACKEND=sheets
GOOGLE_SHEET_ID=<sheet id from step 1>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email>
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
SESSION_SECRET=<32+ random characters>
ADMIN_USERS_JSON=[...]        # see below
```
Keep the `\n` sequences in the private key and wrap it in double quotes.

**Staff accounts:** run `npm run hash-password -- "a strong password"`, then paste the *escaped* hash (dollar signs written as `\$`) into `.env.local`. On a host dashboard (e.g. Vercel) paste the plain hash. Roles: `ADMIN`, `COORDINATOR`, `JUDGE`.

## 5. Create the tabs and headers automatically
```
npm run setup:sheets
```
This creates these tabs and writes stable headers (safe to re-run):

| Tab | Purpose |
|---|---|
| Applications | One row per submitted application (74 columns, see `lib/google-sheets/schema.ts`). **Source of truth for the dashboard.** |
| Drafts | Saved-progress records (hashed resume token + partial JSON). Personal data: restrict access. |
| Application Events | Audit trail: submissions, status changes. |
| Applicant Metrics / Business Metrics / Inclusion Metrics / State Metrics | Formula summaries for coordinators and Power BI. The website does not depend on them. |
| Admin Users / Judges / Configuration | Reserved for Batches 2–3. **Passwords are never stored in the sheet.** |

**Never rename or reorder columns in `Applications`** once real data exists; only append new columns at the right (and add them in `schema.ts`).

## 6. Test submission
1. `npm run dev`, open http://localhost:3000/apply (the window must be open; for testing set `APPLICATION_OPEN_DATE` earlier in `.env.local`).
2. Submit an application choosing **State = Kaduna**.
3. Check the `Applications` tab: a new row with `location_group = FOCAL_STATES` and an `AGRA-2026-XXXXXX` id.

## 7. Test admin analytics
1. Open http://localhost:3000/admin/login and sign in.
2. The dashboard should show Total 1, Kaduna 1, Focal states 1. Submit another with State = Lagos: Other states becomes 1.
3. Compare with the `State Metrics` tab.

## Troubleshooting
- **403 / "caller does not have permission"**: the sheet is not shared with the service-account email as Editor.
- **"Unable to parse range"**: a tab is missing or renamed. Re-run `npm run setup:sheets`.
- **"DECODER routines::unsupported" / invalid key**: the private key lost its `\n` sequences or quotes.
- Google Sheets allows ~60 requests/minute/user. Fine for this contest; move to a SQL backend before large scale.
