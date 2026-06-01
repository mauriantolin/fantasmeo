# Fantasmeo — Design Spec

**Date:** 2026-06-01
**Status:** Approved

## What

Fantasmeo is a job application tracker SaaS. It tracks applications across platforms (LinkedIn, Talent Connect, job boards, any URL), tailors the user's CV to each job description with AI — with a configurable "ghost level" slider that controls how much the CV stretches the truth — generates cover letters, and monitors the user's Gmail inbox to automatically surface recruiter responses in each application's timeline.

## Why

Applying to many positions means: manually adapting the CV per JD, losing track of which application is in which state, and missing recruiter emails buried in the inbox. Fantasmeo automates all three.

## Constraints

- **Closed multi-tenant:** invite-only registration. Multi-user architecture (RLS per user), but no public signup. Google OAuth app stays in "testing" mode (≤100 test users), avoiding Google's verification process.
- **Free-tier infrastructure:** Vercel Hobby + Supabase free tier. The 15-minute Gmail sync is scheduled by Supabase pg_cron (Vercel Hobby crons only run daily).
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres, Auth, Storage, pg_cron) · Vercel AI SDK + AI Gateway · `@react-pdf/renderer` · `googleapis`.
- Deployed on Vercel via GitHub integration (user connects the repo manually after handoff).

## Architecture

Single Next.js monolith on Vercel. All backend logic (JD scraping, AI calls, PDF generation, Gmail sync) lives in route handlers / server actions. Supabase provides persistence, auth, file storage, and the cron trigger.

```
fantasmeo/
├── app/
│   ├── (auth)/login/                  # Google sign-in
│   ├── (app)/
│   │   ├── dashboard/                 # stats + recent events feed
│   │   ├── applications/              # list + filters
│   │   ├── applications/[id]/         # detail: timeline, tailored CV, cover letter
│   │   ├── applications/new/          # create: URL or pasted JD
│   │   ├── cv/                        # base CV management
│   │   └── settings/                  # Gmail connection, invites, profile
│   └── api/
│       ├── cron/gmail-sync/route.ts   # called by pg_cron every 15 min (Bearer CRON_SECRET)
│       └── gmail/oauth/
│           ├── connect/route.ts       # starts OAuth flow
│           └── callback/route.ts      # stores encrypted tokens
├── components/                        # shadcn/ui + app components
├── lib/
│   ├── supabase/                      # browser/server clients, middleware helpers
│   ├── ai/                            # prompts + AI calls (parse CV, parse JD, tailor, cover letter, email matching)
│   ├── gmail/                         # OAuth client, sync logic, token encryption
│   ├── scraping/                      # JD fetcher (fetch + readability extraction)
│   └── pdf/                           # Harvard template (react-pdf)
├── supabase/
│   ├── migrations/                    # SQL schema + RLS policies + pg_cron job
│   └── config.toml
└── docs/superpowers/specs|plans/
```

## Data model

All tables have RLS: `user_id = auth.uid()`. The `invites` table is readable only by existing users; writes via service role.

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `profiles` | User profile | `id (FK auth.users)`, `full_name`, `email`, `phone`, `location`, `linkedin_url` |
| `invites` | Signup allowlist | `email`, `invited_by`, `used_at` |
| `base_cvs` | Base CVs | `user_id`, `title`, `language`, `raw_file_path` (Storage), `content` (jsonb, structured CV), `is_active` |
| `applications` | One per job application | `user_id`, `company_name`, `position_title`, `platform`, `job_url`, `jd_text`, `jd_summary` (jsonb), `status`, `applied_at`, `notes` |
| `generated_cvs` | AI-tailored CVs | `application_id`, `base_cv_id`, `ghost_level` (0–100), `content` (jsonb), `pdf_path` |
| `cover_letters` | AI cover letters | `application_id`, `content` (text), `pdf_path` |
| `application_events` | Timeline / traceability | `application_id`, `type`, `title`, `description`, `email_id` (nullable FK), `metadata` (jsonb), `occurred_at` |
| `gmail_connections` | Gmail OAuth per user | `user_id`, `email_address`, `access_token_enc`, `refresh_token_enc`, `token_expires_at`, `last_sync_at`, `status` |
| `matched_emails` | Inbox matches | `user_id`, `application_id` (nullable), `gmail_message_id`, `gmail_thread_id`, `from_address`, `subject`, `snippet`, `body_text`, `received_at`, `match_confidence`, `match_status`, `ai_classification` (jsonb) |

**Application status enum:** `draft → applied → response_received → interview → offer` plus terminal `rejected`, `ghosted`, `withdrawn`.

**Event types:** `created`, `applied`, `cv_generated`, `cover_letter_generated`, `email_received`, `status_changed`, `note_added`.

**Structured CV JSON (`content`):** `{ contact: {name, email, phone, location, linkedin, website}, summary, experience: [{company, title, start, end, location, bullets[]}], education: [{institution, degree, start, end}], skills: [{category, items[]}], languages: [{name, level}], certifications: [{name, issuer, year}] }`. This shape is shared by base CVs and generated CVs, and is what the Harvard PDF template renders.

## Auth

- Supabase Auth with Google as the only sign-in provider.
- Sign-in and Gmail access are **separate consents**: login requests only identity; Gmail's `gmail.readonly` scope is requested later from Settings via a dedicated OAuth flow (tokens stored by the app, not by Supabase Auth).
- Invite gate: after OAuth sign-in, a check verifies the email exists in `invites` (or matches the `OWNER_EMAIL` env var, which bootstraps the first account). Uninvited users are signed out and shown a "request an invite" screen.

## AI flows (all via Vercel AI SDK + AI Gateway)

1. **Parse base CV:** PDF upload → Storage → text extraction → AI structures it into the CV JSON → user reviews/edits in a form → saved as `base_cvs.content`.
2. **Parse JD:** URL fetch (server-side, readability extraction) → AI extracts `{company, position, seniority, required_skills[], nice_to_have[], keywords[], language, summary}` → stored in `applications.jd_summary`. If fetch fails or content looks blocked/empty → UI falls back to paste-the-text.
3. **Tailor CV:** inputs = base CV JSON + JD summary + ghost_level (0–100). The ghost level modulates prompt instructions in 4 bands:
   - **0–25 (Honesto):** reorder, emphasize, rewrite bullets using JD keywords. Facts untouched.
   - **26–50 (Maquillado):** stretch terminology — technologies touched become working experience; generalize roles to cover JD requirements.
   - **51–75 (Fantasma):** inflate seniority and responsibilities; add plausible tasks the user could defend.
   - **76–100 (Fantasma total):** maximum defensible stretch.
   - **Hard rule at every level:** never fabricate degrees, certifications, employers, or dates. Output language = JD language.
4. **Cover letter:** inputs = tailored CV (or base CV) + JD summary + company. Output in JD language, ~250–350 words, editable before export.
5. **Email matching (sync):** inputs = email (from, subject, body) + the user's active applications (company, position, recent events). Output = `{application_id | null, confidence (0–1), classification: rejection|interview|offer|info_request|other, summary}`.

## Gmail sync

1. User connects Gmail in Settings → OAuth flow with `gmail.readonly` → access+refresh tokens encrypted (AES-256-GCM, key in env var) → `gmail_connections`.
2. Supabase pg_cron job (every 15 min) → `net.http_post` to `https://<app>/api/cron/gmail-sync` with `Authorization: Bearer <CRON_SECRET>`.
3. Sync per active connection: refresh token if needed → list messages newer than `last_sync_at` (Gmail API `q` filter) → cheap pre-filter (skip newsletters/no-reply bulk via heuristics) → AI matching against active applications → high confidence (≥0.8): create `matched_emails` + `application_events` entry + suggested status change; medium (0.5–0.8): create as `pending_review` for manual confirmation; low: ignore.
4. Failures: token revoked → mark connection `status = error`, show reconnect banner. Sync errors are logged and never crash the cron run (per-connection isolation).

## PDF generation

`@react-pdf/renderer` with a Harvard-style template: centered name, contact line, section headers with horizontal rules, serif typography, bullet lists. Renders the structured CV JSON. Generated on demand, stored in Storage, downloadable from the application detail page. Same engine renders cover letter PDFs.

## UI

shadcn/ui components, dark mode default, clean Linear/Vercel-like aesthetic. **UI copy in Spanish** (the product's audience); code, identifiers, and comments in English. Key screens:

- **Dashboard:** counters (active, awaiting response, interviews, ghosted), recent events feed, "needs review" email matches.
- **Applications list:** filterable table (status, platform), search.
- **Application detail:** vertical timeline (events), tailored CV panel with ghost slider + generate button, cover letter panel, PDF downloads, manual status change, notes.
- **New application:** URL input → auto-parse → editable preview → fallback paste textarea.
- **Base CV:** upload, parsed content editor, multiple CVs with one active per language.
- **Settings:** profile, Gmail connect/disconnect, invite management.

## Error handling

- JD scraping failure → automatic fallback to paste-text UI (never a dead end).
- AI call failure → one retry with backoff, then clear error message with retry button.
- Gmail token expiry/revocation → connection marked `error`, banner prompts reconnect.
- Cron endpoint → 401 without valid secret; per-user errors isolated.
- All user inputs validated at the edges (zod schemas in server actions / route handlers).

## Testing

- Unit (Vitest): ghost-level prompt band selection, email pre-filter heuristics, CV JSON validation (zod schemas), invite gate logic.
- Integration: application creation flow with mocked AI/fetch.
- E2E (Playwright, phase 5): smoke test of login → create application → generate CV happy path against local dev.

## Implementation phases

1. **Foundation:** Next.js 16 scaffold, Supabase schema + RLS + migrations, Google sign-in, invite gate, base CV upload + AI parsing + editor.
2. **Applications:** CRUD, JD scraping + AI parsing, fallback paste, status management, timeline events.
3. **AI generation:** CV tailoring + ghost slider, cover letters, Harvard PDF export.
4. **Gmail:** OAuth connect flow, encrypted token storage, pg_cron + sync endpoint, AI email matching, review UI.
5. **Polish & handoff:** dashboard, dark mode pass, README with Vercel/Supabase/Google Cloud setup instructions, env var documentation.

## Out of scope (v1)

- Public signup / Google OAuth verification.
- Sending emails (replies) — read-only inbox access.
- Browser extension for one-click capture.
- Multiple Gmail accounts per user.
- Payment/billing.
