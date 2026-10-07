# Security review

| Area | Finding | Status |
|---|---|---|
| Authentication | Signed JWT in HttpOnly cookie, bcrypt hashes in env, login limited to 5 tries / 15 min | OK |
| Authorisation | Every admin API and page re-checks the role's permission; judges cannot read applicants, mentors, exports or AI; tested | OK (tested) |
| Access to applicant data | List API returns only table fields; detail loaded server-side; mentor list omits contact details | OK |
| CSRF | State-changing routes require same-origin (or allow-listed) `Origin` | OK |
| Uploads | Content sniffing, size limit, allow-list, strict folder ids, private delivery, signed short-lived admin links | OK in tests; verify once against live Cloudinary |
| XSS | React escapes output; applicant text is only rendered as text; links validated as `https://` | OK |
| Spreadsheet injection | Cells starting `= + - @` neutralised in Sheets writes and CSV export | OK (tested) |
| AI | No DB access; aggregates only; query log; admin-only | OK (tested with a mock provider) |
| Secrets | All in environment variables; `.env*` git-ignored; none in the code (scanned) | OK |
| Rate limiting | In-memory (per server instance). Fine for one instance; use Redis/Upstash if you scale to several | **Open** |
| Content-Security-Policy | Not set (Next.js inline scripts need a nonce setup) | **Open**: add before launch if required |
| Client IP trust | `x-forwarded-for` only trusted when `TRUST_PROXY=true` in production | Fixed |
| Sheets as database | Anyone with edit access to the sheet can read all applicant data. Restrict sharing | Operational risk |
| Judge accounts | No assignment-based access yet (Batch 3) so judges see no applicants | By design |
