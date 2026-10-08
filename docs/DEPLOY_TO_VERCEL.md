# "My latest code is not on Vercel": how to fix it

Vercel only builds what is in **GitHub**, on the **production branch**. Copying new files into your folder does nothing until they are committed and pushed.

## 1. Push the new code
Run these in the project folder, the one that contains `package.json`:
```
git status            # shows the changed files
git add -A
git commit -m "Staff accounts in the sheet, system checks"
git push
```
If `git push` says "no upstream" or "rejected", tell me the exact message.

## 2. Check that Vercel built it
Open Vercel → your project → **Deployments**:
- The top deployment should be **just now** and **Ready**.
- **Error** means the build failed. While a build is failing, **the old version stays live**. Open the failed build, copy the red lines and send them to me.
- **No new deployment at all?** Check these in **Settings**:
  - **Git**: the connected repository is the one you pushed to, and the **Production Branch** (usually `main`) is the branch you pushed.
  - **Build & Development → Root Directory**: it must be the folder that contains `package.json`. If the project sits in a subfolder such as `agri-contest/`, set it to that subfolder.

## 3. Confirm
```
npm run check:live -- https://agri-contest.vercel.app
```
The first line must say the live version matches your local version (currently `2026.10.08.2`). You can also open `/api/health` and look for `"version"`.

## Changing settings (environment variables)
After any change in **Settings → Environment Variables**, go to **Deployments → ⋯ → Redeploy**. Settings are only read when the site is built.
