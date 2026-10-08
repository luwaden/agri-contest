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
| Rate limiting | Now shared across all server instances through Upstash Redis (falls back to per-instance memory if Redis is not configured) | Fixed when Redis is configured |
| Content-Security-Policy | Not set (Next.js inline scripts need a nonce setup) | **Open**: add before launch if required |
| Client IP trust | `x-forwarded-for` only trusted when `TRUST_PROXY=true` in production | Fixed |
| Sheets as database | Anyone with edit access to the sheet can read all applicant data. Restrict sharing | Operational risk |
| Judge / Reviewer access | Permission `applications:view-assigned` only; no list, export, analytics, file or admin-AI access; tested for both roles. Assignment itself arrives with scoring | OK (tested) |
| Reviewer role | Added with the same limits as a judge; admins/coordinators cannot score | OK (tested) |
| Diagnostics | `/api/health?check=store` is public but returns only booleans and error categories (no secrets); optional `HEALTH_CHECK_TOKEN`; rate-limited | OK |
| Error responses | 500s now carry a short non-sensitive `code` and `ref` (details only in server logs) | OK |
| Duplicate submissions | One application per e-mail, enforced atomically with Redis (two simultaneous submits: exactly one succeeds; tested) | OK |
| Assistant | Visitors get knowledge-base answers only; staff analytics are aggregates; applicant text is treated as untrusted data in prompts; reference lookup returns the receipt date only | OK (tested) |
| Two-factor sign-in | Not available | **Open**: recommended before real judging |
