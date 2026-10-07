# AI architecture (ChatGPT or Claude, without database access)

```
DATABASE (Google Sheets / future SQL)
   ↓  repository interface (lib/repository)
SERVICES (lib/services/analyticsService.ts)          ← controlled queries only
   ↓
CONTEXT BUILDER (lib/ai/context.ts)                  ← decides exactly what the AI may see
   ↓  one string: question + JSON of summary figures
AIProvider (lib/ai/index.ts)  →  OpenAIProvider | ClaudeProvider
   ↓  HTTPS to the vendor
ADMIN UI (/admin/ai → /api/admin/ai, permission "ai:query", ADMIN only)
```

**The AI never receives:** database credentials, a connection, a query tool, SQL/Mongo access, or raw applicant tables.

## What it can see
| Always | Aggregate counts and percentages: totals, per state, per zone, Kaduna/Niger/Nasarawa, gender, age group, value chain, stage, revenue band, disability and rural counts, reported impact totals, progress against internal targets |
|---|---|
| Never | Names, emails, phone numbers, addresses, dates of birth, application ids, business names, documents |
| Optional (off) | Up to 40 short excerpts of "problem/solution" text with emails, links and phone numbers stripped. Needs `AI_ALLOW_TEXT_EXCERPTS=true` **and** a question about challenges/themes. Free text can still contain a name someone typed, so enable only after a privacy decision |

## Safeguards
- Authenticated, authorised (`ai:query`), rate-limited (20 / 10 min), same-origin only.
- Applicant text is wrapped as untrusted data in the system prompt to resist prompt injection.
- Every query is logged to *Application Events* (who, provider, how many records considered, the question). Answers are not stored.
- The UI tells the admin what was shared.

## Switching on
`AI_PROVIDER=openai` + `OPENAI_API_KEY` + `OPENAI_MODEL`, **or** `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`. No code change. Until then the panel says it is not switched on.

## Adding a question type
Add a function to `analyticsService.ts`, include its (aggregate) result in `buildAIContext`, and extend `tests/platform.test.ts` so a test proves no personal data is included.
