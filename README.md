# Fantasmeo

Fantasmeo is a personal job application tracker with AI-powered CV tailoring and cover letter generation. The key feature is the **ghost level** slider, which controls how aggressively the AI reshapes your CV to fit a given job description — from a light polish all the way to... well, a stretch. It also connects to Gmail to automatically detect when companies reply, and flags applications as ghosted after 21 days of silence.

**Features:**

- Google sign-in with invite gate (only approved emails can access)
- Base CV upload with AI parsing
- Application tracking from a job URL or pasted text
- CV tailoring with 4 ghost levels (1 = honest touch-up, 4 = creative storytelling)
- Harvard-style PDF export of the tailored CV
- AI cover letter generation per application
- Gmail sync that auto-matches company replies to applications
- Automatic ghosted detection after 21 days of no response
- Dashboard with stats and a review queue for pending applications

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 · Tailwind CSS 4 · shadcn/ui |
| Language | TypeScript |
| Database / Auth / Storage | Supabase (Postgres + Auth + Storage + pg_cron) |
| AI | Vercel AI SDK v6 via AI Gateway |
| PDF generation | @react-pdf/renderer |
| Gmail integration | googleapis |
| Testing | Vitest |

---

## Local development

**Prerequisites:** Node 20+, npm.

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in each value:

```bash
cp .env.example .env.local
```

| Variable | How to obtain |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → project → Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → project → Settings → API → `service_role` key (keep secret) |
| `AI_GATEWAY_API_KEY` | Vercel dashboard → AI tab → AI Gateway → API keys |
| `AI_MODEL` | Optional. Defaults to `anthropic/claude-sonnet-4.5` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 client |
| `GOOGLE_CLIENT_SECRET` | Same OAuth 2.0 client as above |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local development |
| `OWNER_EMAIL` | The email that always passes the invite gate |
| `CRON_SECRET` | Any random 32-character string (protects the `/api/cron/gmail-sync` endpoint) |
| `ENCRYPTION_KEY` | 64 hex characters (32 bytes), used to encrypt stored Gmail tokens. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Run

```bash
npm run dev      # development server at http://localhost:3000
npm test         # run Vitest test suite
npm run build    # production build
```

---

## Supabase setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Apply migrations in order using the SQL editor (Dashboard → SQL Editor) or the Supabase MCP:
   - `supabase/migrations/00001_schema.sql`
   - `supabase/migrations/00002_rls.sql`
   - `supabase/migrations/00003_storage.sql`
3. Enable the Google auth provider: Dashboard → Authentication → Providers → Google. Paste your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Copy the **Callback URL** shown by Supabase — you will need to add it to the Google OAuth client (see next section).
4. Copy the project URL and API keys from Dashboard → Settings → API into your `.env.local`.

---

## Google Cloud setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Enable the **Gmail API**: APIs & Services → Library → search "Gmail API" → Enable.
3. Configure the OAuth consent screen: APIs & Services → OAuth consent screen.
   - User type: **External**
   - Publishing status: **Testing** (add the owner email and any invitee emails as test users)
4. Create an OAuth client: APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - Application type: **Web application**
   - Authorized redirect URIs — add **both**:
     - The Supabase auth callback: `https://<project-ref>.supabase.co/auth/v1/callback`
     - The app's Gmail callback: `{NEXT_PUBLIC_APP_URL}/api/gmail/oauth/callback` (add one entry for `http://localhost:3000` and one for your production URL)
5. Copy the Client ID and Client Secret into `.env.local`.

---

## Vercel deployment

1. Connect the GitHub repository in the Vercel dashboard.
2. Set all environment variables from the table above. Use the production URL for `NEXT_PUBLIC_APP_URL`.
3. Enable AI Gateway: Vercel dashboard → AI tab → enable AI Gateway. `AI_GATEWAY_API_KEY` is not required on Vercel itself (OIDC is used automatically), but keep it in `.env.local` for local development.
4. Deploy.

---

## pg_cron setup

After the first successful deploy, apply the cron job manually in the Supabase SQL editor. Open `supabase/migrations/00004_pg_cron.sql.example`, replace `<APP_URL>` with your production URL and `<CRON_SECRET>` with the value of your `CRON_SECRET` env var, then run it.

This schedules `POST /api/cron/gmail-sync` every 15 minutes to pull Gmail replies and match them to open applications.

---

## Architecture

Fantasmeo is a Next.js monolith deployed on Vercel. All data, authentication, and file storage go through Supabase. AI calls (CV tailoring, cover letter generation, job description parsing) are routed through the Vercel AI Gateway so they benefit from caching, rate limiting, and observability without exposing provider keys to the client.

Gmail sync is driven by a pg_cron job in Supabase that POSTs to `/api/cron/gmail-sync` on a 15-minute interval. The route is protected by a `CRON_SECRET` bearer token. Each sync fetches new threads for connected Gmail accounts, attempts to match them to known application domains, and updates application statuses accordingly. Applications with no activity after 21 days are automatically marked as ghosted.

For the full design and implementation plan see:
- [`docs/superpowers/specs/2026-06-01-fantasmeo-design.md`](docs/superpowers/specs/2026-06-01-fantasmeo-design.md)
- [`docs/superpowers/plans/2026-06-01-fantasmeo-implementation.md`](docs/superpowers/plans/2026-06-01-fantasmeo-implementation.md)
