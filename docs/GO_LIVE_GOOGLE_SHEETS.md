# Go live tonight: application form → Google Sheets

Two ways to connect the form to a Google Sheet. **Both are free.** Pick one.

| | **Option A: Apps Script in the sheet** (Extensions menu) | **Option B: Google Cloud service account** |
|---|---|---|
| Setup time | **about 15 minutes** | about 30 minutes |
| Needs Google Cloud Console | **No** | Yes (free; no card needed) |
| Needs a key file | **No** (just a secret you make up) | Yes (JSON key) |
| Speed per save | 1 to 3 seconds | under 1 second |
| Best for | **Getting live tonight**, a few hundred applications | Heavier traffic, long-term |
| Setting | `DATA_BACKEND=appsscript` | `DATA_BACKEND=sheets` |

You can switch later without losing data: both write the same sheet in the same layout.

> **Honest note:** I tested both routes with a local store and a simulated Google Sheet (the Apps Script was run in a simulation that deliberately mangles dates, phone numbers and `=` text unless the script forces plain text, as real Sheets can), but **not with a real Google account**. So **do the local test in step A6 / B5 before you deploy.**

**Skip tonight:** Cloudinary, AI. Leave them unset. The "Upload a file" buttons will say uploads are unavailable and ask applicants to paste a link; links still work.

---

# Option A: Apps Script inside the sheet (fastest)

### A1. Create the sheet (1 min)
<https://sheets.google.com> → **Blank spreadsheet** → name it `AGRA-SMEDAN Applications`.

### A2. Paste the script (2 min)
1. In the sheet: **Extensions → Apps Script**.
2. Delete the sample code. Open `apps-script/Code.gs` from the project, copy **all** of it, paste it in. Press **Ctrl+S** to save.

### A3. Set your secret (1 min)
1. In Apps Script click the **gear icon (Project Settings)**.
2. Scroll to **Script properties → Add script property**: name `SECRET`, value = a long random text (32+ characters). Save.
   (Make one: run `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`, or use any password generator.) **Keep a copy: the website needs the same value.**

### A4. Create the tabs and allow the script (3 min)
1. Back in the editor, in the toolbar pick the function **`setup`** and click **Run**.
2. Click **Review permissions** → choose your Google account.
3. You will see **"Google hasn't verified this app"**. This is normal: it is your own script. Click **Advanced → Go to (your project) (unsafe) → Allow**.
4. Look at the sheet: it now has tabs `Applications`, `Drafts`, `Application Events`, `Mentors` (and 3 reserved ones), each with a bold header row.

### A5. Publish it as a web app (3 min)
1. **Deploy → New deployment**. Click the gear next to "Select type" → **Web app**.
2. **Execute as: Me.** **Who has access: Anyone.** (The secret is what protects it.)
3. **Deploy** → copy the **Web app URL** (it ends in `/exec`).
4. Check it: open that URL in your browser. You should see `{"ok":true,"service":"agra-smedan-contest"}` and **no data**.

### A6. Set the website variables and test on your computer (5 min)
Make `.env.local` in the project folder (copy `.env.example`):
```
DATA_BACKEND=appsscript
APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXX/exec
APPS_SCRIPT_SECRET=the-same-secret-you-put-in-script-properties
SESSION_SECRET=any-random-text-of-32-or-more-characters
ADMIN_USERS_JSON=[{"email":"you@example.org","name":"Your Name","role":"ADMIN","passwordHash":"PASTE_HASH"}]
```
- **Password hash:** run `npm run hash-password -- "choose-a-long-password"`. It prints two lines. In `.env.local` use the one with `\$` (escaped). On Vercel/Render use the plain one. Keep the JSON on **one line**.
- **Dates:** if you set nothing, applications are open **2 Oct – 16 Oct 2026** (Nigerian time).

Then:
```bash
npm install
npm run dev               # http://localhost:3000
```
1. Open <http://localhost:3000/api/health>: it must show `"dataStore":"appsscript"` and `"appsScript":true`.
2. Go to `/apply`, fill in test data (**State = Kaduna**), submit. You get a reference like `AGRA-2026-K7QX4M`.
3. Open the Google Sheet → **Applications** tab: a new row appears. Check the date of birth still reads `1998-04-12` and the phone starts with `+234`.
4. Sign in at `/admin/login`: the dashboard shows 1 application and Kaduna 1.

If any step fails, use the table at the bottom. **Do not deploy until this works.**

**If you later change the script code:** Deploy → **Manage deployments → ✏️ Edit → Version: New version → Deploy**. Without a new version the old code keeps running.

→ Continue at **Deploy** below.

---

# Option B: Google Cloud service account

(Free. The Console is free to open; the Sheets API and service accounts cost nothing. It only has usage limits, about 60 requests a minute per user. If a screen asks for a card or a "free trial", you are on a billing page: skip it.)

### B1. Create the sheet
<https://sheets.google.com> → blank spreadsheet. Copy the **Sheet ID** from the address bar: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` = `GOOGLE_SHEET_ID`.

### B2. Create the service account
1. <https://console.cloud.google.com> → create a project (any name).
2. **APIs & Services → Library** → **Google Sheets API → Enable**.
3. **Credentials → Create credentials → Service account** → name `contest-web` → Done.
4. Open it → **Keys → Add key → Create new key → JSON**. A file downloads. **Never share it or commit it.**
5. From the JSON: `client_email` = `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `private_key` = `GOOGLE_PRIVATE_KEY`.

### B3. Share the sheet with the robot
Sheet → **Share** → paste `client_email` → **Editor** → untick Notify → Share.

### B4. Variables
```
DATA_BACKEND=sheets
GOOGLE_SHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=contest-web@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE....\n-----END PRIVATE KEY-----\n"
SESSION_SECRET=...
ADMIN_USERS_JSON=[...]            # as in A6
```
**Private key (the step most people get wrong):** open the downloaded JSON file in Notepad. Find the line `"private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...`. Copy **only the value between the quote marks**. It is ONE long line with `\n` written inside it. Paste it as one line: **do not press Enter inside it** and do not turn the `\n` into line breaks. Put double quotes around it in `.env` / `.env.local` (no quotes on Vercel/Render). The email and the key must come from the **same** JSON file.

### B5. Check, create the tabs and test
Run these **one at a time** (in PowerShell, do not paste the `#` comments):
```bash
npm install
npm run check:google      # checks your settings and says exactly what to fix. Writes nothing
npm run setup:sheets      # creates tabs + header row ("Headers set: Applications (74 columns)")
npm run dev
```
`npm run check:google` must end with **"All good"** before you run `setup:sheets`. Ignore the npm notices about "vulnerabilities" and "allow-scripts"; they do not affect this.
(If it fails: name the first tab exactly `Applications`, run `npm run print:headers`, paste the output into cell A1, and add tabs `Drafts`, `Application Events`, `Mentors`.)
Test exactly as A6 steps 1 to 4 (health shows `"dataStore":"sheets"` and `"sheets":true`).

---

# Deploy (both options, 15 min)
Push the project to a **private** GitHub repository (confirm `.env.local` is not uploaded).

- **Vercel:** New Project → import the repo → add the variables → Deploy.
- **Render:** New → Web Service → Build `npm ci && npm run build` → Start `npm start` → Health check `/api/health` → add the variables.

Host variables = the ones from your option, plus:
- `NEXT_PUBLIC_SITE_URL=https://your-live-address` and `TRUST_PROXY=true`
- Use the **plain** password hash (no `\$`); no quotation marks around the private key.
- `DATA_BACKEND` **must** be `appsscript` or `sheets`. The app deliberately refuses the local test store in production.

### Check it live (5 min)
1. `https://your-site/api/health` shows your `dataStore`.
2. Submit a test application on the live site (phone and laptop); confirm the row appears.
3. Sign in at `/admin/login`.
4. **Delete your test rows** (row 2 and below; **keep row 1, the headers**).

### Protect the data
Share the sheet only with the people who must see applicants (it holds names, phones, emails). Never commit `.env.local`, the JSON key, or the Apps Script secret. Do not rename or reorder the header columns after real applications arrive.

---

## If something goes wrong
| What you see | Likely cause | Fix |
|---|---|---|
| **A:** "Apps Script returned a non-JSON reply" | Deployed with the wrong access, or you used the editor URL | Redeploy as **Web app**, Who has access = **Anyone**; the URL must end in `/exec` |
| **A:** error `forbidden` | Secret differs between the script and the website | Make `SECRET` (script properties) and `APPS_SCRIPT_SECRET` identical, with no spaces |
| **A:** error `sheet missing: run setup()` | `setup` was never run | Run `setup` in the Apps Script editor |
| **A:** I edited the script but nothing changed | Old version still deployed | Deploy → Manage deployments → Edit → **New version** |
| **A:** save feels slow (1 to 3 s) | Normal for Apps Script | Fine for this contest; use Option B for heavy traffic |
| **B:** logs say **403** / "caller does not have permission" | Sheet not shared with the robot | Step B3 |
| **B:** `Unable to parse range` | A tab is missing/misspelled | Re-run `npm run setup:sheets` |
| **B:** `check:google` says "No .env or .env.local file in this folder", or every setting is "missing" | You are in a new project folder. The zip never includes your `.env` (it holds your secrets), or Notepad saved it as `.env.txt` | Copy `.env` from your old folder into the folder that contains `package.json` (PowerShell: `Copy-Item "C:\path\to\old-folder\.env" .env`), or rename `.env.txt` to exactly `.env` (`Rename-Item .env.txt .env`). Check with `dir -Force`, which shows hidden files |
| **B:** `error:1E08010C:DECODER routines::unsupported` | The private key was damaged when pasted, most often split over several lines in `.env` | Run `npm run check:google`: it says what is wrong. Re-copy the `"private_key"` value from the JSON as **one line** with the `\n` kept, inside double quotes |
| **B:** `check:google` says "Google rejected the login" | Wrong or deleted key, or the computer's clock is wrong | Create a new key (Service account → Keys → Add key → JSON) and use its email **and** key together; check the clock and time zone |
| **B:** `check:google` says "Google Sheets API is switched off" | API not enabled | Cloud Console → APIs & Services → Library → Google Sheets API → Enable |
| Pages work but the form errors with "DATA_BACKEND=local is not allowed in production" | Host missing the variable | Set `DATA_BACKEND` and redeploy |
| `/api/health` shows `"dataStore":"local"` | Variables not set on this machine/host | Check your `.env.local` / host variables |
| First application missing from the sheet | Header row missing (row 1 skipped) | Make sure row 1 has the 74 headers |
| `/apply` says "not open yet / closed" | Dates | `APPLICATION_OPEN_DATE` / `_CLOSE_DATE` (must include `+01:00`) |
| Admin login always fails | `$` in the hash was mangled | Local file: `\$` version. Host dashboard: plain. Keep the JSON on one line |
| "An application has already been submitted with this email" | Same email twice (by design) | Use another test email or delete the old row |
