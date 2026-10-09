# Updating the live site safely while applications are open

**What this update changes in your data:** it adds new columns at the **end** of two tabs and creates any missing tabs.
- **Mentors** gets `first_name` and `last_name`.
- **Admin Users** gets `password_hash` and `updated_at`.

It never moves, renames or deletes a column, and never edits or deletes an applicant's row. **The Applications tab does not change at all.**

**What applicants notice:** nothing.
- People halfway through an application keep their saved progress, and their resume links still work.
- The duplicate-email check still knows everyone who has already applied.
- Anyone who has the **panel form** open from before the update is asked to refresh the page.
- Staff may need to sign in again once.

Allow about 30 minutes. Do it at a quiet time, such as late evening.

---

## Step 1. Take a snapshot (2 minutes)
In the Google Sheet: **File → Version history → Name current version** → type `Before update 9 Oct`.
Google keeps it, and you can look at it any time.

## Step 2. Run the safety check (5 minutes, read-only)
In the new project folder (with your `.env` copied in, using the **same Google settings as Vercel**):
```
npm ci
npm run preflight -- https://agri-contest.vercel.app
```
This command **cannot change your sheet**: it uses a read-only permission. It does four things:
- It saves a full backup of every tab in a `backups` folder on your computer. Keep that folder private: it holds personal data. It is never uploaded to GitHub.
- It checks that row 1 of every tab lines up with the new code. The app writes by column **position**, so this matters.
- It reads **every existing application and panel application** with the new code and writes it back in memory, to prove nothing would shift or be lost.
- It ends with **✔ SAFE TO DEPLOY** or **✘ STOP**.

**If it says STOP, do not continue.** Send me the ✘ lines (they contain no personal data) and I will adapt the code to your sheet.

## Step 3 (recommended). Try it on a preview link first
This lets you click through the new version without touching the live site or the live sheet.
1. In Google Sheets: **File → Make a copy** of the live sheet. Share the copy with your service-account email as **Editor**. Copy the new id from the copy's address (the part between `/d/` and `/edit`).
2. Vercel → **Settings → Environment Variables**:
   - Add `GOOGLE_SHEET_ID` = the **copy's** id, ticked for **Preview only**.
   - Make sure the other settings (`DATA_BACKEND`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SESSION_SECRET`, `ADMIN_USERS_JSON`) are ticked for Preview too.
   - **Leave the Upstash settings for Production only.** The preview then runs without Redis, which is fine and keeps test data out of the live Redis.
3. Push the code to a **new branch**, not `main`:
   ```
   git checkout -b update-oct-9
   git add -A
   git commit -m "Panel form update, safety checks"
   git push -u origin update-oct-9
   ```
   Vercel builds a **Preview** link (Deployments tab). The live site is untouched.
4. On the preview link:
   - Submit a test application.
   - Submit a panel application (try the single role choice and LinkedIn).
   - Sign in and run **Admin → System check**.

   Check the rows appear in the **copy** of the sheet.

## Step 4. Add the new columns to the live sheet (1 minute)
```
npm run setup:sheets
```
It only adds the column titles listed by the preflight, creates missing tabs, and refreshes the four "Metrics" tabs, which are formulas, so don't keep notes there.
This is safe to run while the old site is still live, because the old code ignores columns it doesn't know.
**Never use `--force` on the live sheet.**

## Step 5. Go live
If you used a branch:
```
git checkout main
git merge update-oct-9
git push
```
Otherwise:
```
git add -A
git commit -m "Panel form update"
git push
```
Vercel builds the new version while the old one keeps serving visitors, then switches over in an instant, with no downtime. **If the build fails, nothing changes:** the old version stays live.

## Step 6. Confirm (5 minutes)
```
npm run check:live -- https://agri-contest.vercel.app --email you@example.org
```
- The live version must be **2026.10.09**, with no ✘ items.
- The **Applications** tab has the same number of rows as before (compare with the preflight's "Records checked" line).
- Submit one test application from your phone, find its row, then delete that row (keep row 1). Do the same for a panel application.

---

## If something looks wrong: roll back in 1 minute
Vercel → **Deployments** → the previous Production deployment → **⋯ → Promote to Production** (or **Instant Rollback**).
- The old version works fine with the extra columns, so there is nothing else to undo.
- If data itself ever needs restoring, use **File → Version history** or your `backups` folder. **Copy back only the cells you need.** Restoring a whole old version would also remove applications received since then.

## Never do these on the live sheet
- Insert, delete, reorder or rename columns in **Applications**, **Mentors** or **Drafts**. Adding columns to the right of the last one is fine; the app ignores them.
- Run `npm run setup:sheets -- --force`.
- Clear the Upstash database. It holds the duplicate-email list and saved progress.
- Change `SESSION_SECRET`. That signs every staff member out. It's harmless, but annoying.
