# Local development and production (Render)

## Local
```bash
npm install
cp .env.example .env.local        # fill what you need; with nothing set it runs on a local JSON store
npm run dev                        # http://localhost:3000
npm test                           # unit tests
npm run build && npm start         # production build (needs DATA_BACKEND=sheets)
npm run setup:sheets               # creates the Google Sheet tabs and headers
```
`DATA_BACKEND=local` is refused in production on purpose.

## Production on Render (Web Service)
| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Node | 20 or newer |
| Environment | every variable in `.env.example`; set `DATA_BACKEND=sheets`, `NEXT_PUBLIC_SITE_URL=https://your-domain`, `TRUST_PROXY=true`, a strong `SESSION_SECRET` |

Secrets live only in Render's environment settings. Session cookies are `HttpOnly`, `SameSite=Lax` and `Secure` in production. Render's free/instance disk is ephemeral, which is why the local JSON store is blocked.

## Preparing for a separate Express.js backend
The code is layered so the API can be moved out without rewriting business logic:

| Layer | Where | Depends on Next.js? |
|---|---|---|
| UI | `components/`, `app/**/page.tsx` | yes |
| HTTP adapters | `app/api/**/route.ts` (thin: rate limit, origin check, parse JSON, call a service) | yes |
| **Services** | `lib/services/*` (applications, mentors, uploads, analytics, AI, export) | **no** |
| Domain / validation | `lib/validation`, `lib/mapper.ts`, `lib/analytics`, `lib/ai`, `lib/cloudinary` | **no** |
| Data | `lib/repository` (interface) → Google Sheets / local; swap for Postgres or MongoDB by implementing the interface | no |

To move to Express: create an Express app, mount each `route.ts` handler as `router.post(...)` calling the same service functions, replace `lib/auth/server.ts` (cookie reading) with middleware, and set `CORS_ALLOWED_ORIGINS` to the frontend's origin. Auth uses a signed JWT cookie, which Express can verify with the same `jose` code.

## Logging and errors
Handlers return friendly messages to users and log the technical detail with `console.error` (visible in Render logs). No secrets or applicant data are logged by the app.
