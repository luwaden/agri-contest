# Confirmation emails

**Who gets an email:**
- **Applicants only.** Each gets one email right after they submit. It contains their reference number, the time they submitted, "the programme team reviews all applications and will contact shortlisted applicants", and how to get in touch. It never repeats their answers.
- **youthagriinnovate@gmail.com** keeps a copy of every confirmation in its **Sent** folder, because the emails are sent from that account. Applicants' **replies** land in its inbox.
- **Nobody else.** Mentor, judge and reviewer (panel) applications send no email, and there are no team notices.

**Safety:**
- The email is sent **after** the application is saved and the reference number is on screen. If the email fails, the application still succeeds.
- A failed email is recorded in the **Application Events** tab as `EMAIL_FAILED` with the reason.
- No new columns are added, and nothing in your sheet changes.
- Until you add the settings below, emails stay **off** and the site works exactly as now.

---

## Option 1: Gmail (recommended now: free, no website domain needed)
Sends from youthagriinnovate@gmail.com, **about 500 emails a day**. That is enough for about 200 applications a day.

1. Sign in to **youthagriinnovate@gmail.com**.
2. Turn on **2-Step Verification**: <https://myaccount.google.com/security>.
3. Create an **App Password**: <https://myaccount.google.com/apppasswords>.
   - Name it `Agri contest website`, then press **Create**.
   - Copy the **16 letters** it shows.
   - This is not your Gmail password, and it only lets the website send mail.
4. Add to your `.env` on your computer:
   ```
   GMAIL_USER=youthagriinnovate@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   ```
5. Test from your computer: `npm run email:test -- your-own-address@gmail.com`. Check the inbox and the **Spam** folder.
6. Add the same two settings on Vercel: **Settings → Environment Variables → Production**. Then **redeploy**.
7. Check **Admin → System check**. "Confirmation emails" should be ✔ and say Gmail.

If Google ever blocks sending for the day (the limit is reached), confirmations fail until the next day. Applications are not affected, and each miss is logged as `EMAIL_FAILED`.

## Option 2: Resend (when you have your own website domain)
Better for large volumes. Emails come from an address like `apply@yourdomain.org`. Copies are kept in Resend's dashboard, not in the Gmail Sent folder.
- Resend **cannot send from a Gmail address**. You need a domain you own, and you must add the DNS records Resend gives you.
- The **free plan stops at 100 emails a day**, which is less than you are receiving. The **Pro plan (USD 20 a month) has no daily limit**.

Settings:
```
RESEND_API_KEY=re_...
EMAIL_FROM=Youth Agri-Innovation Contest <apply@yourdomain.org>
```
If both Gmail and Resend settings are present, Resend is used. Test with `npm run email:test -- you@example.org`, add the settings on Vercel, then redeploy.

## Where to look if someone says "I got no email"
1. Ask them to check **Spam** or **Promotions**.
2. In the sheet, look in **Application Events** for their reference with action `EMAIL_FAILED`. The detail says why.
3. Their reference number is always shown on screen after they submit, and it is in the Applications tab.
