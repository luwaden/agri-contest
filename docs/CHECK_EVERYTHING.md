# How to check that the whole system works

There are three checks. Do them in this order.

## 1. On your computer: `npm run check:system`
Run this in the project folder. It uses your `.env`.
It tests:
- the settings
- Redis
- the Google Sheet and every tab's column titles
- a real write and read-back
- that a full application fits the sheet
- the staff accounts, with a table showing who can sign in

Every ✘ comes with the fix.

## 2. Against the live site: `npm run check:live`
```
npm run check:live -- https://agri-contest.vercel.app --email you@example.org
```
It asks for your password with the typing hidden. Then it checks four things:
1. **Is the latest code live?** It compares the site's version with the version on your computer. If they differ, see `DEPLOY_TO_VERCEL.md`.
2. **Can the live site reach the sheet and Redis?**
3. **Do the pages, the stylesheet and the partner logos load?**
4. **The full system check on the live server.** It signs in as you and runs the same checks as **Admin → System check**.

## 3. The final proof (2 minutes)
1. On your phone, submit one test application.
2. See the reference number.
3. Find the row in the "Applications" tab.
4. Delete that row, but keep row 1.

## Common results
| You see | Meaning |
|---|---|
| `Live version … differs` | Vercel is still running old code. See `DEPLOY_TO_VERCEL.md` |
| `Sign-in failed (401)` | That account doesn't exist on the site you checked, or the password is wrong. `npm run check:system` lists the accounts |
| `Column titles … ✘` | Run `npm run setup:sheets` |
| `No active administrator` | `npm run make-user -- "you@example.org" "Your Name" ADMIN "a-long-password"` |
