# How logging in works (in plain English)

## The short version
- **Applicants and visitors do not log in.** They just fill in the form. Their saved progress is kept by a private "resume link".
- **Staff log in** at `/admin/login` with an **email and password**. Staff are: **Administrators, Coordinators, Judges and Reviewers**.
- After logging in, the website puts a small **sealed note (a cookie)** in your browser that says who you are and what you may do. It lasts **8 hours**, then you log in again.
- What you can see depends on your **role**. The website checks this on **every page and every action**, not just by hiding buttons.

## Think of it like a building with four key cards
| Role | Who it's for | What the card opens |
|---|---|---|
| **Administrator** | Programme owner / technical lead | Everything: all applications, dashboard and analytics, export, panel applications, AI questions, status changes |
| **Coordinator** | Day-to-day programme staff (e.g. PiH team) | Same as administrator except settings. Can change statuses, export, review panel applications, ask the AI about numbers. **Cannot score.** |
| **Judge** | Panel judges | **Only applications assigned to them**, and the scoring form. Cannot see lists, totals, exports or other judges' scores |
| **Reviewer** *(new)* | Screening-round reviewers | Same limits as a judge, used for the early screening rounds |

Staff who run the programme (Administrators, Coordinators) have **no scoring permission at all**. This matches the framework's rule that "programme staff do not score entries".

## What happens when you log in (step by step)
1. You type your email and password on `/admin/login`.
2. The server looks up your email in the staff list. Your password is **never stored**. Only a scrambled version (a "hash") is stored, so even the people who run the site cannot read it.
3. If the password matches, the server creates the sealed note (signed with `SESSION_SECRET`, so it cannot be forged) and sends you to your home page: Administrator and Coordinator → `/admin`, Judge → `/judge`, Reviewer → `/review`.
4. Every time you open a page or click something that changes data, the server checks the note and your role again.
5. **Wrong password 5 times** within 15 minutes → locked out for 15 minutes (this protects against guessing).
6. Click **Sign out**, or wait 8 hours, and the note is discarded.

## Where the staff list lives
In the **"Admin Users" tab** of your Google Sheet. It stores only password hashes, never the passwords themselves. No redeploy is needed when you add someone.

**First administrator** (on your computer, with the Google settings in `.env`):
```
npm run setup:sheets
npm run make-user -- "you@example.org" "Your Name" ADMIN "green-maize-harvest-7"
```
make-user saves the account to the sheet, reads it back and checks the password. Passwords must be at least 10 characters and **must not contain the part of your email before the @**. For example, `ada@…` cannot use a password containing "ada".

**Everyone else** goes through **Admin → Staff → Add person**. Choose a role, press Add, and send the **invite link** privately. The person sets their own password (the link lasts 48 hours, and Redis must be on). On the same page you can change a role, **Deactivate** someone (they are signed out at once) or create a reset link.

**Break-glass:** `npm run make-user -- … --env` prints an entry for the `ADMIN_USERS_JSON` setting. Use it only if the sheet is unavailable. That setting needs a redeploy, and it wins over the sheet when an email is in both.

## Forgot password (the easiest way that is still safe)
No email service is needed. It uses Redis (Upstash), so Redis must be switched on.
1. The person clicks **Forgot your password?** on the sign-in page. It tells them to ask an administrator.
2. An administrator opens **Admin → Staff**, finds the person, clicks **Create reset link**, and sends the link privately (WhatsApp, SMS or email).
3. The person opens the link, types a new password twice (10+ characters), and signs in.

Safety built in: the link **works once** and **expires after 30 minutes**; only administrators can create links; every link created and every reset is written to the audit log; after a reset, **all older sign-ins of that person are signed out**; the old password stops working immediately. The password in `ADMIN_USERS_JSON` is simply overridden (no redeploy needed).

**If the only administrator forgets their own password:** add a second administrator now (recommended), or use the break-glass route: `npm run make-user` → update `ADMIN_USERS_JSON` on Vercel → redeploy.

*Possible upgrade later:* a fully self-service "email me a link" button. It needs an email service (e.g. Resend, or Gmail with an app password) and takes a short extra setup.

## What this setup is good at, and where it is limited
| Good | Limit (and the next step) |
|---|---|
| No passwords stored, nothing to leak from the sheet | Add, deactivate and invite people from Admin → Staff (no redeploy) |
| Simple and secure for a handful of staff | Password resets need an administrator to send the link (no self-service email yet) |
| Roles checked server-side everywhere | No two-factor sign-in yet. Recommended before real judging |
| | Judges/Reviewers see **no applications until assignments are built** (next release). That is deliberate: they must never browse the full list |

## How a person becomes a judge or reviewer
1. They apply on **/mentors** ("Join the experts") and choose Mentor, Judge and/or Reviewer. Judges and reviewers also tick the conflict-of-interest declaration.
2. An administrator reviews them at **Admin → Panel applications** and sets the status to Accepted.
3. The administrator adds them in Admin → Staff and sends the invite link.

## Applicants
No account. They get a **reference number** (e.g. `AGRA-2026-K7QX4M`) and can type it into the **Ask** assistant to confirm the application was received. The assistant only ever returns the receipt date, never the answers they gave.
