# Fixing "500" when applicants fill in or submit the form on Vercel

**What the 500 means:** the website could not reach its data store (your Google Sheet). It works on your computer because your computer has the settings in `.env`. **Vercel does not read your `.env` file**: every setting must be added in Vercel itself.

## Step 0: is the NEW code actually live?
Open `https://agri-contest.vercel.app/api/health`. The current release shows `"version":"2026.10.08.2"`, a `"features"` list and `"redis"`. **If you do not see `"version"`, the old code is still deployed**: push/upload the new code and redeploy, otherwise none of the checks below exist.

## The best test: Admin → System check
Sign in, open **Admin → System check**, press **Run system check**. In about 5 to 20 seconds it tests, on the live server, everything an application needs:
settings, Redis (write/read/delete), the sheet connection and tabs, that row 1 of Applications matches the app's 74 headers exactly, **a real write to the sheet and read-back** (one audit row `SYSTEM_CHECK` in "Application Events"), that a full sample application converts into a sheet row and back without loss, the application window, and the AI. Every red item says how to fix it. It never adds a fake application.

**The final proof** is still one real test application from your phone: submit it, see the reference number, find the row in the sheet, then delete that row (keep row 1).

## Step 1: find the exact cause (30 seconds)
Open this in your browser (use your real address):

`https://agri-contest.vercel.app/api/health?check=store`

It answers in plain words, for example:
| It says | Meaning | Fix |
|---|---|---|
| `STORE_NOT_CONFIGURED` | The Google settings are missing on Vercel | Step 2 |
| `GOOGLE_KEY` | The private key was pasted wrongly | Step 3 |
| `SHEET_NOT_SHARED` | The sheet is not shared with the service account | Share the sheet with the service-account email as **Editor** |
| `SHEET_NOT_FOUND` | `GOOGLE_SHEET_ID` is wrong | Copy the id from the sheet's address (between `/d/` and `/edit`) |
| `SHEET_TAB_MISSING` | A tab is missing | On your computer run `npm run setup:sheets` once |
| `SHEET_QUOTA` | Google's "60 reads a minute" limit was hit by many people at once | Add Redis (see `UPSTASH.md`) |
| `"ok": true` | The store works; the cause was something else | Tell me the `code` and `ref` the form shows |

Every failed submission now also shows a short **`code` and `ref`** (visible in the browser's Network tab, response of `/api/applications`). Search that `ref` in **Vercel → your project → Logs** to see the full technical error.

## Step 2: add the settings on Vercel
Vercel → your project → **Settings → Environment Variables**. Add (for **Production**):

| Name | Value |
|---|---|
| `DATA_BACKEND` | `sheets` |
| `GOOGLE_SHEET_ID` | the id from the sheet's address |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key file |
| `GOOGLE_PRIVATE_KEY` | the `private_key` value from the JSON, as one line, **without quotation marks** |
| `SESSION_SECRET` | any random text of 32+ characters |
| `ADMIN_USERS_JSON` | optional break-glass only (staff now live in the Admin Users tab) |
| `NEXT_PUBLIC_SITE_URL` | `https://agri-contest.vercel.app` |
| `TRUST_PROXY` | `true` |

## Step 3: if the key is the problem
Copy only what is **between the quote marks** after `"private_key":` in the JSON file. It is one long line containing `\n`. Paste it as it is. Do not add quotes, and do not press Enter inside it.

## Step 4: REDEPLOY (people forget this)
Changing settings does **nothing** until you redeploy: Vercel → **Deployments** → the latest one → **⋯ → Redeploy**.

## Step 5: confirm
Open `/api/health?check=store` again: it must say `"ok": true`. Then submit a test application and look for the row in the sheet (delete it afterwards, keeping row 1).

## Why the draft message also failed
"Save progress" wrote to the same sheet. With Redis connected (`UPSTASH.md`), saved progress goes to Redis instead, so it keeps working and no longer uses up Google's limit, but the **submission** still needs the sheet, so Steps 1 to 5 are still required.
