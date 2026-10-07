# Cloudinary media

```
programme/
  applicants/stage-1|2|3/<upload-session>/   applicant files (today supporting documents are collected in stage 3)
  mentors/<upload-session>/                  mentor CV / documents
  programme-assets/                          site imagery managed by the team
  admin/                                     files uploaded by staff
```
- **Which applicant owns a file?** The applicant's browser creates a random `<upload-session>`. At submission the server tags every file `app_AGRA-2026-XXXXXX` (mentors: `mentor_MNTR-…`). Search that tag in Cloudinary, or open the application in the admin area and use its document links. The database stores the file URLs, never the files.
- **Private by default.** `CLOUDINARY_DELIVERY=authenticated`: the raw URL does not open for the public. Staff open files through `/api/admin/files`, which checks permission, logs the view, and redirects to a 5-minute signed link.
- **Validated before upload:** real file type from the file's first bytes (not the name), allowed: PDF, PNG, JPG, WebP, DOCX, PPTX; maximum `UPLOAD_MAX_MB` (8); folder/owner ids must match a strict pattern; 25 uploads / 10 min per IP.
- **Setup:** create a Cloudinary account → Dashboard → copy cloud name, API key, API secret into the env vars.
- **Test after deploying (important):** upload a file in the form, then open the application as admin and click "Open securely". This was verified against a mock Cloudinary that independently checked the signatures, **not** against the live service, so confirm it once for real.
