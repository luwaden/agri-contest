/** Bump on each release. Shown by /api/health and the System check page so you can see which code is live. */
export const APP_VERSION = "2026.10.08.2";
export const FEATURES = ["redis", "store-check", "system-check", "assistant-staff", "password-reset", "reviewer-role", "staff-in-sheet", "check-live"] as const;
export const commit = () => (process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || "").slice(0, 7) || "local";
