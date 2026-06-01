# Fantasmeo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Fantasmeo — a job application tracker with AI CV tailoring (ghost-level slider), cover letter generation, and automatic Gmail response tracking.

**Architecture:** Single Next.js 16 (App Router) monolith deployed on Vercel. Supabase provides Postgres (with RLS), Auth (Google sign-in), Storage (CV/PDF files), and pg_cron (triggers the Gmail sync endpoint every 15 min). All AI calls go through Vercel AI Gateway via the AI SDK.

**Tech Stack:** Next.js 16.1.x · React 19 · TypeScript 5.9 · Tailwind CSS 4 + shadcn/ui · @supabase/supabase-js + @supabase/ssr · Vercel AI SDK v5 (`ai` package, gateway model strings) · zod · @react-pdf/renderer · googleapis · unpdf (PDF text extraction) · linkedom + @mozilla/readability (JD scraping) · Vitest

**Spec:** `docs/superpowers/specs/2026-06-01-fantasmeo-design.md`

**Environment:** Windows 11, Node v24.15.0, npm 11.12.1. Reference project with proven version combo: `../mail-dashboard/package.json` (Next 16.1.7 + Tailwind 4.2.1 + shadcn 4.2.0).

---

## Shared contracts

Every task references these. They are the source of truth — if a task's code conflicts with this section, this section wins.

### Environment variables (`.env.local`, never committed)

```bash
# Supabase (from project settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Vercel AI Gateway (auto via OIDC when deployed on Vercel; key needed for local dev)
AI_GATEWAY_API_KEY=<key>
AI_MODEL=anthropic/claude-sonnet-4.5

# Gmail OAuth (Google Cloud project, OAuth client type "Web application")
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
OWNER_EMAIL=otros@mauricioantolin.com
CRON_SECRET=<random-32-char-string>
ENCRYPTION_KEY=<64-hex-chars (32 bytes)>
```

### Core types (`lib/types.ts`)

```typescript
export interface CVContact {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

export interface CVExperience {
  company: string;
  title: string;
  start: string; // "2023-01" or "2023"
  end: string | null; // null = present
  location?: string;
  bullets: string[];
}

export interface CVEducation {
  institution: string;
  degree: string;
  start?: string;
  end?: string;
}

export interface CVSkillGroup {
  category: string;
  items: string[];
}

export interface CVLanguage {
  name: string;
  level: string;
}

export interface CVCertification {
  name: string;
  issuer?: string;
  year?: string;
}

export interface CVContent {
  contact: CVContact;
  summary?: string;
  experience: CVExperience[];
  education: CVEducation[];
  skills: CVSkillGroup[];
  languages: CVLanguage[];
  certifications: CVCertification[];
}

export interface JDSummary {
  company: string;
  position: string;
  seniority?: string;
  required_skills: string[];
  nice_to_have: string[];
  keywords: string[];
  language: string; // ISO 639-1: "es", "en", ...
  summary: string;
}

export type ApplicationStatus =
  | "draft"
  | "applied"
  | "response_received"
  | "interview"
  | "offer"
  | "rejected"
  | "ghosted"
  | "withdrawn";

export type EventType =
  | "created"
  | "applied"
  | "cv_generated"
  | "cover_letter_generated"
  | "email_received"
  | "status_changed"
  | "note_added";

export type EmailClassificationType =
  | "rejection"
  | "interview"
  | "offer"
  | "info_request"
  | "other";

export interface EmailMatchResult {
  application_id: string | null;
  confidence: number; // 0-1
  classification: EmailClassificationType;
  summary: string; // one-line summary in Spanish for the timeline
}
```

### Zod schemas (`lib/schemas.ts`)

Mirror of the types above for AI structured output and input validation. `cvContentSchema`, `jdSummarySchema`, `emailMatchResultSchema`. AI calls use these with `generateObject`; server actions use them to validate user input.

```typescript
import { z } from "zod";

export const cvContentSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
  }),
  summary: z.string().optional(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      location: z.string().optional(),
      bullets: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
    })
  ),
  skills: z.array(
    z.object({ category: z.string(), items: z.array(z.string()) })
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().optional(),
      year: z.string().optional(),
    })
  ),
});

export const jdSummarySchema = z.object({
  company: z.string(),
  position: z.string(),
  seniority: z.string().optional(),
  required_skills: z.array(z.string()),
  nice_to_have: z.array(z.string()),
  keywords: z.array(z.string()),
  language: z.string(),
  summary: z.string(),
});

export const emailMatchResultSchema = z.object({
  application_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  classification: z.enum([
    "rejection",
    "interview",
    "offer",
    "info_request",
    "other",
  ]),
  summary: z.string(),
});
```

### AI model access (`lib/ai/client.ts`)

```typescript
// AI SDK v5 + Vercel AI Gateway: passing a "creator/model" string to
// generateText/generateObject routes through the gateway automatically.
// Locally requires AI_GATEWAY_API_KEY; on Vercel it authenticates via OIDC.
export const AI_MODEL = process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5";
```

### Database naming

snake_case for all tables/columns. Tables: `profiles`, `invites`, `base_cvs`, `applications`, `generated_cvs`, `cover_letters`, `application_events`, `gmail_connections`, `matched_emails`. Storage buckets: `cv-uploads` (original PDFs), `generated-pdfs` (tailored CVs + cover letters).

### File structure (final state)

```
fantasmeo/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── components.json                      # shadcn config
├── vitest.config.ts
├── proxy.ts                             # Next 16 route protection (replaces middleware.ts)
├── app/
│   ├── globals.css
│   ├── layout.tsx                       # root layout (fonts, theme)
│   ├── page.tsx                         # redirects: logged in → /dashboard, else → /login
│   ├── (auth)/
│   │   ├── login/page.tsx               # Google sign-in button
│   │   └── auth/
│   │       ├── callback/route.ts        # Supabase OAuth callback + invite gate
│   │       └── error/page.tsx           # uninvited / auth error screen
│   ├── (app)/
│   │   ├── layout.tsx                   # sidebar shell, requires session
│   │   ├── dashboard/page.tsx
│   │   ├── applications/
│   │   │   ├── page.tsx                 # list
│   │   │   ├── new/page.tsx             # create flow
│   │   │   ├── actions.ts               # server actions (CRUD, status, events)
│   │   │   └── [id]/
│   │   │       ├── page.tsx             # detail: timeline + CV + cover letter
│   │   │       └── actions.ts           # tailor CV, cover letter, export PDF
│   │   ├── cv/
│   │   │   ├── page.tsx                 # base CV list + upload
│   │   │   ├── actions.ts               # upload, parse, save edits
│   │   │   └── [id]/page.tsx            # parsed CV editor
│   │   └── settings/
│   │       ├── page.tsx                 # profile, Gmail, invites
│   │       └── actions.ts
│   └── api/
│       ├── cron/gmail-sync/route.ts     # POST, Bearer CRON_SECRET
│       ├── gmail/oauth/connect/route.ts # GET → redirect to Google consent
│       ├── gmail/oauth/callback/route.ts# GET → store encrypted tokens
│       └── pdf/[type]/[id]/route.ts     # GET → render + download PDF (type: cv|cover-letter)
├── components/
│   ├── ui/                              # shadcn components (generated)
│   ├── app-sidebar.tsx
│   ├── status-badge.tsx
│   ├── ghost-slider.tsx
│   ├── timeline.tsx
│   ├── cv-editor.tsx                    # form editor for CVContent JSON
│   ├── cv-preview.tsx                   # read view of CVContent
│   └── email-review-card.tsx
├── lib/
│   ├── types.ts
│   ├── schemas.ts
│   ├── utils.ts                         # shadcn cn() helper
│   ├── supabase/
│   │   ├── client.ts                    # browser client
│   │   ├── server.ts                    # server client (cookies)
│   │   ├── admin.ts                     # service-role client (cron only)
│   │   └── proxy.ts                     # session refresh helper used by /proxy.ts
│   ├── ai/
│   │   ├── client.ts                    # model id constant
│   │   ├── parse-cv.ts                  # PDF text → CVContent
│   │   ├── parse-jd.ts                  # raw JD text → JDSummary
│   │   ├── tailor-cv.ts                 # base CV + JD + ghost level → CVContent
│   │   ├── ghost-level.ts               # band mapping + prompt instructions
│   │   ├── cover-letter.ts              # CV + JD → letter text
│   │   └── match-email.ts               # email + applications → EmailMatchResult
│   ├── gmail/
│   │   ├── crypto.ts                    # AES-256-GCM encrypt/decrypt
│   │   ├── oauth.ts                     # google OAuth2 client factory
│   │   ├── sync.ts                      # sync orchestration per connection
│   │   └── prefilter.ts                 # cheap heuristics to skip bulk mail
│   ├── scraping/
│   │   └── jd-fetcher.ts                # URL → readable text (or throws ScrapeError)
│   └── pdf/
│       ├── harvard-cv.tsx               # react-pdf Harvard CV template
│       └── cover-letter-pdf.tsx         # react-pdf cover letter template
├── supabase/
│   └── migrations/
│       ├── 00001_schema.sql
│       ├── 00002_rls.sql
│       ├── 00003_storage.sql
│       └── 00004_pg_cron.sql.example    # template; applied manually with real URL/secret
├── tests/
│   ├── ghost-level.test.ts
│   ├── schemas.test.ts
│   ├── prefilter.test.ts
│   ├── crypto.test.ts
│   └── jd-fetcher.test.ts
└── docs/superpowers/
    ├── specs/2026-06-01-fantasmeo-design.md
    └── plans/2026-06-01-fantasmeo-implementation.md
```

### Conventions

- UI copy in **Spanish**; code, identifiers, comments, commits in **English**.
- Server actions validate input with zod at the top. No defensive error handling in internal code.
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Author: Mauricio Antolin <otros@mauricioantolin.com>. **No Claude attribution anywhere.**
- Tests run with `npx vitest run`. Build check: `npm run build`. Both must pass before each phase's final commit.

---

## Phase 1: Foundation

### Task 1: Scaffold Next.js 16 project

**Files:**
- Create: entire Next.js scaffold at repo root (the repo already exists with `docs/` and `.git/`)

- [ ] **Step 1: Scaffold with create-next-app**

Run from `fantasmeo/` parent directory is NOT possible (create-next-app wants an empty dir). Scaffold into a temp dir and move files in:

```powershell
# from C:\Users\a950839\OneDrive - ATOS\Dev
npx --yes create-next-app@latest fantasmeo-scaffold --ts --app --tailwind --eslint --no-src-dir --turbopack --import-alias "@/*" --use-npm --yes
# move everything except .git into fantasmeo/
Get-ChildItem fantasmeo-scaffold -Force | Where-Object Name -ne ".git" | Move-Item -Destination fantasmeo -Force
Remove-Item fantasmeo-scaffold -Recurse -Force
```

Expected: `fantasmeo/` now contains `package.json` with `next: 16.x`, `app/`, `tsconfig.json`, etc.

- [ ] **Step 2: Install runtime dependencies**

```powershell
cd fantasmeo
npm install @supabase/supabase-js @supabase/ssr ai zod @react-pdf/renderer googleapis unpdf linkedom @mozilla/readability date-fns
npm install -D vitest @types/node prettier prettier-plugin-tailwindcss
```

Expected: no peer-dependency errors. If `@react-pdf/renderer` complains about React 19, add `--legacy-peer-deps` and note it in README.

- [ ] **Step 3: Initialize shadcn/ui**

```powershell
npx --yes shadcn@latest init -y -b neutral
npx --yes shadcn@latest add button card input label select textarea badge dialog dropdown-menu slider table tabs sonner skeleton separator avatar alert
```

Expected: `components.json` created, `components/ui/*` populated, `lib/utils.ts` created.

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Add to `package.json` scripts: `"test": "vitest run", "typecheck": "tsc --noEmit"`.

- [ ] **Step 5: Create .env.example and .gitignore entries**

Create `.env.example` with every variable from the Shared Contracts section (placeholder values). Verify `.gitignore` includes `.env*` (create-next-app default does) and add `*.tsbuildinfo`.

- [ ] **Step 6: Smoke test dev server**

```powershell
npm run dev
```

Expected: compiles, http://localhost:3000 renders the Next.js starter page. Stop the server.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js 16 with Tailwind 4, shadcn/ui, and core dependencies"
```

### Task 2: Core types, zod schemas, and unit test setup

**Files:**
- Create: `lib/types.ts` (exact content from Shared Contracts)
- Create: `lib/schemas.ts` (exact content from Shared Contracts)
- Test: `tests/schemas.test.ts`

- [ ] **Step 1: Write failing test**

`tests/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { cvContentSchema, jdSummarySchema, emailMatchResultSchema } from "@/lib/schemas";

describe("cvContentSchema", () => {
  it("accepts a valid CV", () => {
    const valid = {
      contact: { name: "Jane Doe", email: "jane@example.com" },
      experience: [
        {
          company: "Acme",
          title: "Engineer",
          start: "2022-01",
          end: null,
          bullets: ["Built things"],
        },
      ],
      education: [{ institution: "UBA", degree: "Ingeniería" }],
      skills: [{ category: "Languages", items: ["TypeScript"] }],
      languages: [{ name: "Spanish", level: "Native" }],
      certifications: [],
    };
    expect(cvContentSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a CV missing contact.name", () => {
    expect(() =>
      cvContentSchema.parse({ contact: { email: "x@y.z" }, experience: [], education: [], skills: [], languages: [], certifications: [] })
    ).toThrow();
  });
});

describe("emailMatchResultSchema", () => {
  it("rejects confidence > 1", () => {
    expect(() =>
      emailMatchResultSchema.parse({ application_id: null, confidence: 1.5, classification: "other", summary: "x" })
    ).toThrow();
  });

  it("accepts a valid match", () => {
    const valid = { application_id: "abc", confidence: 0.9, classification: "interview", summary: "Te invitan a entrevista" };
    expect(emailMatchResultSchema.parse(valid)).toEqual(valid);
  });
});

describe("jdSummarySchema", () => {
  it("accepts a valid JD summary", () => {
    const valid = {
      company: "Globant",
      position: "SSr Backend Developer",
      required_skills: ["Node.js"],
      nice_to_have: [],
      keywords: ["nodejs", "aws"],
      language: "es",
      summary: "Backend role",
    };
    expect(jdSummarySchema.parse(valid)).toEqual(valid);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schemas.test.ts`
Expected: FAIL — cannot resolve `@/lib/schemas`.

- [ ] **Step 3: Create lib/types.ts and lib/schemas.ts**

Copy exact content from Shared Contracts section.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schemas.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/types.ts lib/schemas.ts tests/schemas.test.ts
git commit -m "feat: add core domain types and zod schemas"
```

### Task 3: Supabase project, schema migrations, and RLS

**Files:**
- Create: `supabase/migrations/00001_schema.sql`
- Create: `supabase/migrations/00002_rls.sql`
- Create: `supabase/migrations/00003_storage.sql`
- Create: `supabase/migrations/00004_pg_cron.sql.example`

**Note:** The Supabase project is created via Supabase MCP (`mcp__supabase__create_project`, org chosen by user) or dashboard. Migrations are applied via `mcp__supabase__apply_migration` (preferred, no local CLI needed). Project name: `fantasmeo`, region: closest to Argentina (`sa-east-1`).

- [ ] **Step 1: Create Supabase project** (MCP or dashboard; record project ref)

- [ ] **Step 2: Write 00001_schema.sql**

```sql
-- Tables ---------------------------------------------------------------
create type application_status as enum (
  'draft','applied','response_received','interview','offer','rejected','ghosted','withdrawn'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  location text,
  linkedin_url text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table public.base_cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  language text not null default 'es',
  raw_file_path text,
  content jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  position_title text not null,
  platform text not null default 'other',
  job_url text,
  jd_text text,
  jd_summary jsonb,
  status application_status not null default 'draft',
  applied_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generated_cvs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  base_cv_id uuid references public.base_cvs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ghost_level int not null check (ghost_level between 0 and 100),
  content jsonb not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table public.matched_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  gmail_message_id text not null,
  gmail_thread_id text,
  from_address text not null,
  from_name text,
  subject text,
  snippet text,
  body_text text,
  received_at timestamptz,
  match_confidence real,
  match_status text not null default 'pending_review'
    check (match_status in ('auto_matched','confirmed','rejected','pending_review')),
  ai_classification jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'created','applied','cv_generated','cover_letter_generated',
    'email_received','status_changed','note_added'
  )),
  title text not null,
  description text,
  email_id uuid references public.matched_emails(id) on delete set null,
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email_address text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  status text not null default 'active' check (status in ('active','error','disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------
create index applications_user_status_idx on public.applications (user_id, status);
create index application_events_application_idx on public.application_events (application_id, occurred_at desc);
create index matched_emails_user_status_idx on public.matched_emails (user_id, match_status);

-- updated_at trigger ----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger base_cvs_updated_at before update on public.base_cvs
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger gmail_connections_updated_at before update on public.gmail_connections
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup -----------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Write 00002_rls.sql**

```sql
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.base_cvs enable row level security;
alter table public.applications enable row level security;
alter table public.generated_cvs enable row level security;
alter table public.cover_letters enable row level security;
alter table public.application_events enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.matched_emails enable row level security;

-- profiles: own row only
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- invites: any authenticated user can read (needed for the invite gate),
-- create invites, and mark them as used (the gate updates used_at)
create policy "invites_select" on public.invites
  for select using (auth.role() = 'authenticated');
create policy "invites_insert" on public.invites
  for insert with check (auth.role() = 'authenticated');
create policy "invites_update" on public.invites
  for update using (auth.role() = 'authenticated');

-- user-owned tables: identical pattern
create policy "base_cvs_own" on public.base_cvs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "applications_own" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generated_cvs_own" on public.generated_cvs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cover_letters_own" on public.cover_letters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "application_events_own" on public.application_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_connections_own" on public.gmail_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "matched_emails_own" on public.matched_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 4: Write 00003_storage.sql**

```sql
insert into storage.buckets (id, name, public) values
  ('cv-uploads', 'cv-uploads', false),
  ('generated-pdfs', 'generated-pdfs', false);

-- Users can only access files under a folder named with their user id:
-- path convention: {user_id}/{filename}
create policy "cv_uploads_own" on storage.objects
  for all using (
    bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "generated_pdfs_own" on storage.objects
  for all using (
    bucket_id = 'generated-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'generated-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 5: Write 00004_pg_cron.sql.example**

```sql
-- Apply manually in the Supabase SQL editor AFTER deploying to Vercel.
-- Replace <APP_URL> and <CRON_SECRET> with real values.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'fantasmeo-gmail-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '<APP_URL>/api/cron/gmail-sync',
    headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 6: Apply migrations 00001–00003 to the Supabase project** (via MCP `apply_migration`, one per file, names `schema`, `rls`, `storage`)

Expected: `list_tables` shows all 9 tables with `rls_enabled: true`.

- [ ] **Step 7: Configure Google sign-in provider in Supabase**

Manual step (dashboard → Authentication → Providers → Google): needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from the Google Cloud OAuth client. Redirect URL shown by Supabase must be added to the Google OAuth client's authorized redirect URIs. Document in README; do not block implementation (auth code can be written before the provider is live).

- [ ] **Step 8: Commit**

```powershell
git add supabase/
git commit -m "feat: add Supabase schema, RLS policies, storage buckets, and pg_cron template"
```

### Task 4: Supabase clients and route protection

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`
- Create: `proxy.ts` (Next.js 16 uses proxy.ts; middleware.ts is deprecated)

- [ ] **Step 1: Create browser client** (`lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client** (`lib/supabase/server.ts`)

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — session refresh is handled by proxy.ts
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create admin client** (`lib/supabase/admin.ts`) — service role, used ONLY by the cron endpoint

```typescript
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 4: Create session-refresh helper + proxy.ts**

`lib/supabase/proxy.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (!user && !isAuthRoute && !isApiRoute && request.nextUrl.pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

`proxy.ts` (root):

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**Note:** if `proxy.ts` is not picked up by the installed Next 16 minor version, fall back to `middleware.ts` with identical content (export named `middleware`). Check Next docs for the exact convention in the installed version.

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```powershell
git add lib/supabase proxy.ts
git commit -m "feat: add Supabase clients and session proxy"
```

### Task 5: Auth — login page, OAuth callback, invite gate

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/auth/callback/route.ts`
- Create: `app/(auth)/auth/error/page.tsx`
- Create: `app/page.tsx` (replace starter)
- Modify: `app/layout.tsx` (metadata, fonts, dark theme)

- [ ] **Step 1: Root layout** — set metadata title "Fantasmeo", description in Spanish, `<html lang="es" className="dark">`, Geist font (create-next-app default), `<Toaster />` from sonner.

- [ ] **Step 2: Root page redirect logic** (`app/page.tsx`)

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
```

- [ ] **Step 3: Login page** — centered card, Fantasmeo logo (👻 emoji + name), tagline in Spanish ("Trackeá tus postulaciones. Fantasmeá lo justo."), Google sign-in button. Client component calling:

```typescript
const supabase = createClient();
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${location.origin}/auth/callback` },
});
```

- [ ] **Step 4: OAuth callback with invite gate** (`app/(auth)/auth/callback/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=no_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange_failed`);
  }

  const email = data.user.email!.toLowerCase();

  // Invite gate: owner always passes; others need an invite row
  if (email !== process.env.OWNER_EMAIL?.toLowerCase()) {
    const { data: invite } = await supabase
      .from("invites")
      .select("id, used_at")
      .eq("email", email)
      .maybeSingle();

    if (!invite) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/error?reason=not_invited`);
    }

    if (!invite.used_at) {
      await supabase.from("invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

**Note:** the invites `update` needs a policy or it will silently fail under RLS. Add to `00002_rls.sql`: `create policy "invites_update_own_email" on public.invites for update using (auth.role() = 'authenticated');` — include this in Task 3 Step 3 from the start.

- [ ] **Step 5: Error page** — Spanish copy: "No estás invitado todavía" / "Pedile una invitación a Mauricio" with reason-specific messages from `?reason=`.

- [ ] **Step 6: Manual verification**

Configure real Supabase env vars in `.env.local`, run `npm run dev`, click login button → Google consent → callback → redirected (will land on /dashboard 404 — that's fine, Task 6 builds it). Uninvited account → error page.

- [ ] **Step 7: Commit**

```powershell
git add app/ lib/
git commit -m "feat: add Google sign-in with invite gate"
```

### Task 6: App shell — sidebar layout and empty pages

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `components/app-sidebar.tsx`
- Create: `app/(app)/dashboard/page.tsx` (placeholder), `app/(app)/applications/page.tsx` (placeholder), `app/(app)/cv/page.tsx` (placeholder), `app/(app)/settings/page.tsx` (placeholder)

- [ ] **Step 1: (app) layout** — server component: fetch user via `createClient()`, redirect to /login if missing, render sidebar + main content area.

- [ ] **Step 2: Sidebar** — nav items with lucide icons: Dashboard (`LayoutDashboard`), Postulaciones (`Briefcase`), Mi CV (`FileText`), Configuración (`Settings`). Bottom: user avatar + email + sign-out button (client component, `supabase.auth.signOut()` then `router.push("/login")`). Active item highlighted by pathname. Ghost emoji 👻 + "Fantasmeo" wordmark at top.

- [ ] **Step 3: Placeholder pages** — each renders page title in Spanish + empty state card ("Todavía no hay nada acá").

- [ ] **Step 4: Manual verification** — `npm run dev`, log in, navigate all four sections, sign out.

- [ ] **Step 5: Commit**

```powershell
git add app/ components/
git commit -m "feat: add app shell with sidebar navigation"
```

### Task 7: Base CV — upload, AI parsing, editor

**Files:**
- Create: `lib/ai/client.ts`, `lib/ai/parse-cv.ts`
- Create: `app/(app)/cv/page.tsx` (replace placeholder), `app/(app)/cv/actions.ts`, `app/(app)/cv/[id]/page.tsx`
- Create: `components/cv-editor.tsx`, `components/cv-preview.tsx`

- [ ] **Step 1: AI client constant** (`lib/ai/client.ts`) — exact content from Shared Contracts.

- [ ] **Step 2: CV parser** (`lib/ai/parse-cv.ts`)

```typescript
import { generateObject } from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import { cvContentSchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import type { CVContent } from "@/lib/types";

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function parseCV(rawText: string): Promise<CVContent> {
  const { object } = await generateObject({
    model: AI_MODEL,
    schema: cvContentSchema,
    prompt: [
      "Extract the structured content of this CV/resume.",
      "Rules:",
      "- Keep the original language of the CV (do not translate).",
      "- Preserve every job, bullet point, skill, and date exactly as written.",
      "- Dates: use 'YYYY-MM' if month is known, else 'YYYY'. Use null for current positions.",
      "- Group skills into sensible categories if the CV does not group them.",
      "",
      "CV text:",
      rawText,
    ].join("\n"),
  });
  return object;
}
```

- [ ] **Step 3: Server actions** (`app/(app)/cv/actions.ts`)

Three actions, all starting with auth check (`createClient()` → `getUser()`, throw if null) and zod validation:

- `uploadAndParseCV(formData)`: file (PDF, max 5MB) + title + language → upload to `cv-uploads/{user.id}/{uuid}.pdf` → `extractPdfText` → `parseCV` → insert `base_cvs` row → `redirect` to `/cv/{id}`
- `updateCVContent(id, content)`: validate with `cvContentSchema` → update `base_cvs.content`
- `deleteCV(id)`: delete row + storage file

- [ ] **Step 4: CV list page** — cards per CV (title, language badge, active toggle, updated date) + upload dialog (file input + title + language select es/en). Empty state with upload CTA.

- [ ] **Step 5: CV editor component** (`components/cv-editor.tsx`)

Client component, props `{ initialContent: CVContent; onSave: (c: CVContent) => Promise<void> }`. Sections: Contacto (inputs), Resumen (textarea), Experiencia (repeatable cards: company/title/dates/location + bullets textarea one-per-line, add/remove buttons), Educación, Skills (category + comma-separated items), Idiomas, Certificaciones. "Guardar" button → calls onSave → sonner toast "CV guardado".

- [ ] **Step 6: CV detail page** (`app/(app)/cv/[id]/page.tsx`) — fetch CV, render `CVEditor` wired to `updateCVContent`.

- [ ] **Step 7: Manual verification** — upload a real PDF CV, verify AI parsing populates the editor, edit a field, save, reload, verify persistence.

- [ ] **Step 8: Commit**

```powershell
git add app/ components/ lib/
git commit -m "feat: add base CV upload with AI parsing and editor"
```

### Task 8: Phase 1 checkpoint

- [ ] **Step 1:** Run `npx vitest run` → all pass. Run `npm run build` → succeeds. Run `npx tsc --noEmit` → clean.
- [ ] **Step 2:** Fix anything broken, commit fixes as `fix:` commits.
- [ ] **Step 3:** Tag: `git tag phase-1-foundation`

---

## Phase 2: Applications

### Task 9: JD scraper

**Files:**
- Create: `lib/scraping/jd-fetcher.ts`
- Test: `tests/jd-fetcher.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/jd-fetcher.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractReadableText, ScrapeError } from "@/lib/scraping/jd-fetcher";

describe("extractReadableText", () => {
  it("extracts the main text from an HTML document", () => {
    const html = `<html><head><title>Job</title></head><body>
      <nav>Menu Home About</nav>
      <article><h1>Backend Developer</h1>
      <p>We are looking for a backend developer with Node.js experience.
      You will build APIs and work with PostgreSQL databases every day.
      The role requires five years of experience and strong communication skills.</p></article>
      <footer>Copyright</footer></body></html>`;
    const text = extractReadableText(html, "https://example.com/job/1");
    expect(text).toContain("backend developer with Node.js");
    expect(text).not.toContain("Copyright");
  });

  it("throws ScrapeError when content is too short to be a JD", () => {
    const html = `<html><body><div>Sign in to view this job</div></body></html>`;
    expect(() => extractReadableText(html, "https://example.com/blocked")).toThrow(ScrapeError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/jd-fetcher.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (`lib/scraping/jd-fetcher.ts`)

```typescript
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export class ScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapeError";
  }
}

const MIN_JD_LENGTH = 200; // chars; shorter content means a login wall or block page

export function extractReadableText(html: string, url: string): string {
  const { document } = parseHTML(html);
  const reader = new Readability(document as unknown as Document, { charThreshold: 100 });
  const article = reader.parse();

  const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();

  if (text.length < MIN_JD_LENGTH) {
    throw new ScrapeError(
      "Could not extract a job description from this page (login wall or blocked)."
    );
  }
  return text;
}

export async function fetchJD(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ScrapeError("Could not reach the URL.");
  }

  if (!response.ok) {
    throw new ScrapeError(`Page responded with status ${response.status}.`);
  }

  const html = await response.text();
  return extractReadableText(html, url);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/jd-fetcher.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/scraping tests/jd-fetcher.test.ts
git commit -m "feat: add JD scraper with readability extraction"
```

### Task 10: JD parser (AI)

**Files:**
- Create: `lib/ai/parse-jd.ts`

- [ ] **Step 1: Implement** (`lib/ai/parse-jd.ts`)

```typescript
import { generateObject } from "ai";
import { jdSummarySchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import type { JDSummary } from "@/lib/types";

export async function parseJD(jdText: string, sourceUrl?: string): Promise<JDSummary> {
  const { object } = await generateObject({
    model: AI_MODEL,
    schema: jdSummarySchema,
    prompt: [
      "Analyze this job description and extract structured information.",
      "Rules:",
      "- 'language' is the ISO 639-1 code of the language the JD is written in (e.g. 'es', 'en').",
      "- 'required_skills' are hard requirements; 'nice_to_have' are desirable extras.",
      "- 'keywords' are ATS-relevant terms (technologies, methodologies, certifications) found in the JD.",
      "- 'summary' is a 2-3 sentence overview of the role, written in the same language as the JD.",
      "- 'seniority' examples: junior, semi-senior, senior, lead, manager.",
      sourceUrl ? `- Source URL (may hint at company/platform): ${sourceUrl}` : "",
      "",
      "Job description:",
      jdText,
    ].join("\n"),
  });
  return object;
}
```

- [ ] **Step 2: Verify typecheck** — `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit**

```powershell
git add lib/ai/parse-jd.ts
git commit -m "feat: add AI JD parser"
```

### Task 11: Applications CRUD + list page

**Files:**
- Create: `app/(app)/applications/actions.ts`
- Create: `app/(app)/applications/page.tsx` (replace placeholder)
- Create: `app/(app)/applications/new/page.tsx`
- Create: `components/status-badge.tsx`

- [ ] **Step 1: Status badge component** — maps each `ApplicationStatus` to Spanish label + color: draft→"Borrador" (gray), applied→"Postulado" (blue), response_received→"Respuesta recibida" (yellow), interview→"Entrevista" (purple), offer→"Oferta" (green), rejected→"Rechazado" (red), ghosted→"Ghosteado 👻" (zinc), withdrawn→"Retirado" (gray outline).

- [ ] **Step 2: Server actions** (`app/(app)/applications/actions.ts`)

All actions: auth check first, zod-validate inputs, `revalidatePath` after writes.

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchJD, ScrapeError } from "@/lib/scraping/jd-fetcher";
import { parseJD } from "@/lib/ai/parse-jd";
import type { JDSummary, ApplicationStatus, EventType } from "@/lib/types";

const createFromUrlInput = z.object({ url: z.string().url() });
const createManualInput = z.object({
  jdText: z.string().min(100),
  url: z.string().url().optional().or(z.literal("")),
});

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function addEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  applicationId: string,
  type: EventType,
  title: string,
  description?: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("application_events").insert({
    application_id: applicationId,
    user_id: userId,
    type,
    title,
    description,
    metadata,
  });
}

// Returns { jdText, jdSummary } or { error: "scrape_failed" } so the UI can fall back to paste mode
export async function previewFromUrl(input: z.infer<typeof createFromUrlInput>) {
  const { url } = createFromUrlInput.parse(input);
  await requireUser();
  try {
    const jdText = await fetchJD(url);
    const jdSummary = await parseJD(jdText, url);
    return { jdText, jdSummary };
  } catch (e) {
    if (e instanceof ScrapeError) return { error: "scrape_failed" as const };
    throw e;
  }
}

export async function previewFromText(input: z.infer<typeof createManualInput>) {
  const { jdText, url } = createManualInput.parse(input);
  await requireUser();
  const jdSummary = await parseJD(jdText, url || undefined);
  return { jdText, jdSummary };
}

const createApplicationInput = z.object({
  companyName: z.string().min(1),
  positionTitle: z.string().min(1),
  platform: z.string().min(1),
  jobUrl: z.string().url().optional().or(z.literal("")),
  jdText: z.string(),
  jdSummary: z.unknown(), // already-validated JDSummary passed through from preview
  markAsApplied: z.boolean(),
});

export async function createApplication(input: z.infer<typeof createApplicationInput>) {
  const parsed = createApplicationInput.parse(input);
  const { supabase, user } = await requireUser();

  const status: ApplicationStatus = parsed.markAsApplied ? "applied" : "draft";
  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      company_name: parsed.companyName,
      position_title: parsed.positionTitle,
      platform: parsed.platform,
      job_url: parsed.jobUrl || null,
      jd_text: parsed.jdText,
      jd_summary: parsed.jdSummary as JDSummary,
      status,
      applied_at: parsed.markAsApplied ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await addEvent(supabase, user.id, application.id, "created", "Postulación creada");
  if (parsed.markAsApplied) {
    await addEvent(supabase, user.id, application.id, "applied", "Te postulaste");
  }

  revalidatePath("/applications");
  redirect(`/applications/${application.id}`);
}

const updateStatusInput = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["draft","applied","response_received","interview","offer","rejected","ghosted","withdrawn"]),
});

export async function updateStatus(input: z.infer<typeof updateStatusInput>) {
  const parsed = updateStatusInput.parse(input);
  const { supabase, user } = await requireUser();

  const updates: Record<string, unknown> = { status: parsed.status };
  if (parsed.status === "applied") updates.applied_at = new Date().toISOString();

  const { error } = await supabase
    .from("applications")
    .update(updates)
    .eq("id", parsed.applicationId);
  if (error) throw new Error(error.message);

  await addEvent(
    supabase, user.id, parsed.applicationId, "status_changed",
    "Cambio de estado", undefined, { new_status: parsed.status }
  );

  revalidatePath(`/applications/${parsed.applicationId}`);
  revalidatePath("/applications");
}

const addNoteInput = z.object({ applicationId: z.string().uuid(), note: z.string().min(1) });

export async function addNote(input: z.infer<typeof addNoteInput>) {
  const parsed = addNoteInput.parse(input);
  const { supabase, user } = await requireUser();
  await addEvent(supabase, user.id, parsed.applicationId, "note_added", "Nota", parsed.note);
  revalidatePath(`/applications/${parsed.applicationId}`);
}

const deleteInput = z.object({ applicationId: z.string().uuid() });

export async function deleteApplication(input: z.infer<typeof deleteInput>) {
  const parsed = deleteInput.parse(input);
  const { supabase } = await requireUser();
  const { error } = await supabase.from("applications").delete().eq("id", parsed.applicationId);
  if (error) throw new Error(error.message);
  revalidatePath("/applications");
  redirect("/applications");
}
```

- [ ] **Step 3: Applications list page** — server component: fetch applications ordered by `updated_at desc`, render table (Empresa, Puesto, Plataforma, Estado, Última actualización) with `StatusBadge`, client-side filter tabs by status group (Activas / Terminadas / Todas), search input filtering by company/position, "Nueva postulación" button → `/applications/new`. Empty state: "Todavía no cargaste ninguna postulación 👻".

- [ ] **Step 4: New application page** (`app/(app)/applications/new/page.tsx`) — client component, 3-step wizard:
  1. **Input:** URL field + "Leer aviso" button (calls `previewFromUrl`); below, a collapsible "Pegar el texto a mano" textarea + platform select (LinkedIn/Talent Connect/Indeed/Glassdoor/Otra) + "Analizar" button (calls `previewFromText`). If `previewFromUrl` returns `scrape_failed`, auto-expand the manual textarea with an explanation toast: "No pudimos leer el aviso (la página lo bloquea). Pegá el texto acá."
  2. **Preview:** editable fields populated from `jdSummary` (empresa, puesto, seniority) + read-only chips for required_skills/keywords + jd summary text. Checkbox "Ya me postulé" (default checked).
  3. **Confirm:** "Crear postulación" → `createApplication`.

- [ ] **Step 5: Manual verification** — create one application from a real job URL (e.g. a public Greenhouse/Lever posting that doesn't block bots), and one with pasted text. Verify both appear in the list.

- [ ] **Step 6: Commit**

```powershell
git add app/ components/
git commit -m "feat: add applications CRUD with JD parsing and creation wizard"
```

### Task 12: Application detail + timeline

**Files:**
- Create: `app/(app)/applications/[id]/page.tsx`
- Create: `components/timeline.tsx`

- [ ] **Step 1: Timeline component** (`components/timeline.tsx`)

Props: `{ events: ApplicationEvent[] }` (define `ApplicationEvent` row type in `lib/types.ts`: id, type, title, description, metadata, occurred_at). Vertical line with dots; each event shows icon by type (created→`Plus`, applied→`Send`, cv_generated→`FileText`, cover_letter_generated→`Mail`, email_received→`Inbox`, status_changed→`ArrowRight`, note_added→`StickyNote`), title, description, relative date in Spanish (date-fns `formatDistanceToNow` with `es` locale).

- [ ] **Step 2: Detail page** — server component fetching application + events + generated CVs + cover letters in parallel (`Promise.all`). Layout: header (company, position, StatusBadge, status dropdown wired to `updateStatus`, link to job_url), two-column grid: left = Timeline + add-note input; right = JD summary card (skills chips, seniority, summary) + placeholder cards "Generar CV" / "Cover letter" (buttons disabled with tooltip "Próximamente" — wired in Phase 3).

- [ ] **Step 3: Add ApplicationEvent and ApplicationRow types to lib/types.ts**

```typescript
export interface ApplicationEvent {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
}

export interface ApplicationRow {
  id: string;
  company_name: string;
  position_title: string;
  platform: string;
  job_url: string | null;
  jd_text: string | null;
  jd_summary: JDSummary | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Manual verification** — open the application created in Task 11, change status, add note, verify timeline updates.

- [ ] **Step 5: Commit**

```powershell
git add app/ components/ lib/
git commit -m "feat: add application detail page with event timeline"
```

### Task 13: Phase 2 checkpoint

- [ ] **Step 1:** `npx vitest run` + `npm run build` + `npx tsc --noEmit` → all green. Fix and commit if not.
- [ ] **Step 2:** Tag: `git tag phase-2-applications`

---

## Phase 3: AI Generation

### Task 14: Ghost level module

**Files:**
- Create: `lib/ai/ghost-level.ts`
- Test: `tests/ghost-level.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/ghost-level.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getGhostBand, getGhostInstructions, GHOST_BAND_LABELS } from "@/lib/ai/ghost-level";

describe("getGhostBand", () => {
  it("maps 0 to honesto", () => expect(getGhostBand(0)).toBe("honesto"));
  it("maps 25 to honesto", () => expect(getGhostBand(25)).toBe("honesto"));
  it("maps 26 to maquillado", () => expect(getGhostBand(26)).toBe("maquillado"));
  it("maps 50 to maquillado", () => expect(getGhostBand(50)).toBe("maquillado"));
  it("maps 51 to fantasma", () => expect(getGhostBand(51)).toBe("fantasma"));
  it("maps 75 to fantasma", () => expect(getGhostBand(75)).toBe("fantasma"));
  it("maps 76 to fantasma_total", () => expect(getGhostBand(76)).toBe("fantasma_total"));
  it("maps 100 to fantasma_total", () => expect(getGhostBand(100)).toBe("fantasma_total"));
  it("throws on out-of-range values", () => {
    expect(() => getGhostBand(-1)).toThrow();
    expect(() => getGhostBand(101)).toThrow();
  });
});

describe("getGhostInstructions", () => {
  it("every band's instructions forbid fabricating credentials", () => {
    for (const level of [0, 30, 60, 90]) {
      const instructions = getGhostInstructions(level);
      expect(instructions).toMatch(/NEVER fabricate/i);
    }
  });

  it("honesto instructions do not allow stretching", () => {
    expect(getGhostInstructions(10)).not.toMatch(/stretch|inflate/i);
  });

  it("fantasma_total instructions allow maximum stretch", () => {
    expect(getGhostInstructions(100)).toMatch(/maximum/i);
  });
});

describe("GHOST_BAND_LABELS", () => {
  it("has Spanish labels for all four bands", () => {
    expect(Object.keys(GHOST_BAND_LABELS)).toEqual([
      "honesto", "maquillado", "fantasma", "fantasma_total",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ghost-level.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (`lib/ai/ghost-level.ts`)

```typescript
export type GhostBand = "honesto" | "maquillado" | "fantasma" | "fantasma_total";

export const GHOST_BAND_LABELS: Record<GhostBand, string> = {
  honesto: "Honesto",
  maquillado: "Maquillado",
  fantasma: "Fantasma",
  fantasma_total: "Fantasma total",
};

export function getGhostBand(level: number): GhostBand {
  if (level < 0 || level > 100 || !Number.isFinite(level)) {
    throw new Error(`Ghost level must be between 0 and 100, got ${level}`);
  }
  if (level <= 25) return "honesto";
  if (level <= 50) return "maquillado";
  if (level <= 75) return "fantasma";
  return "fantasma_total";
}

const HARD_RULE =
  "HARD RULE — applies regardless of anything else: NEVER fabricate degrees, certifications, employer names, or employment dates. " +
  "Every employer, role, degree, and date in the output must exist in the base CV.";

const BAND_INSTRUCTIONS: Record<GhostBand, string> = {
  honesto: [
    "Adaptation level: HONEST (0-25).",
    "- Reorder and re-emphasize the existing content so the most relevant items for this job appear first.",
    "- Rewrite bullet points using the job description's keywords and vocabulary, but keep every fact exactly as it is.",
    "- You may omit irrelevant experience to keep the CV focused.",
    "- Do not add, exaggerate, or generalize anything.",
    HARD_RULE,
  ].join("\n"),
  maquillado: [
    "Adaptation level: POLISHED (26-50).",
    "- Everything from the HONEST level, plus:",
    "- Technologies or tools the candidate has merely touched can be presented as working experience.",
    "- Generalize role descriptions so they cover more of the job's requirements (e.g. 'worked on backend' can become 'designed and built backend services').",
    "- Round up partial experience (e.g. 1.5 years can read as '2 years').",
    HARD_RULE,
  ].join("\n"),
  fantasma: [
    "Adaptation level: GHOST (51-75).",
    "- Everything from the POLISHED level, plus:",
    "- Inflate seniority within the same role (e.g. 'developer' can become 'senior developer' if the dates plausibly support it).",
    "- Add plausible responsibilities and tasks the candidate could credibly have performed in their actual roles, especially ones matching the job requirements.",
    "- Present team contributions as personally led achievements.",
    HARD_RULE,
  ].join("\n"),
  fantasma_total: [
    "Adaptation level: FULL GHOST (76-100).",
    "- Everything from the GHOST level, pushed to the maximum defensible stretch:",
    "- Every requirement in the job description that could plausibly map to the candidate's real experience MUST appear covered in the CV.",
    "- Invent plausible projects, metrics, and achievements inside real jobs (with real employers and real dates) when they help match the job requirements.",
    "- The candidate must still be able to defend every line in an interview with good storytelling — nothing verifiable can be false.",
    HARD_RULE,
  ].join("\n"),
};

export function getGhostInstructions(level: number): string {
  return BAND_INSTRUCTIONS[getGhostBand(level)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ghost-level.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/ai/ghost-level.ts tests/ghost-level.test.ts
git commit -m "feat: add ghost level bands and prompt instructions"
```

### Task 15: CV tailoring + cover letter generation

**Files:**
- Create: `lib/ai/tailor-cv.ts`
- Create: `lib/ai/cover-letter.ts`

- [ ] **Step 1: Implement tailoring** (`lib/ai/tailor-cv.ts`)

```typescript
import { generateObject } from "ai";
import { cvContentSchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import { getGhostInstructions } from "@/lib/ai/ghost-level";
import type { CVContent, JDSummary } from "@/lib/types";

export async function tailorCV(
  baseCV: CVContent,
  jd: JDSummary,
  jdText: string,
  ghostLevel: number
): Promise<CVContent> {
  const { object } = await generateObject({
    model: AI_MODEL,
    schema: cvContentSchema,
    prompt: [
      "You are an expert CV writer. Adapt the candidate's base CV to maximize fit with the target job.",
      "",
      getGhostInstructions(ghostLevel),
      "",
      `Output language: write the ENTIRE CV in "${jd.language}" (the job description's language). Translate content if needed.`,
      "Keep the same JSON structure. Contact info is copied verbatim (never translated or altered).",
      "Order experience bullets by relevance to this job. Aim for 3-5 strong bullets per recent role.",
      "The skills section should lead with the skills this job asks for (among those the adaptation level allows).",
      "",
      "TARGET JOB SUMMARY:",
      JSON.stringify(jd, null, 2),
      "",
      "FULL JOB DESCRIPTION:",
      jdText,
      "",
      "BASE CV:",
      JSON.stringify(baseCV, null, 2),
    ].join("\n"),
  });
  return object;
}
```

- [ ] **Step 2: Implement cover letter** (`lib/ai/cover-letter.ts`)

```typescript
import { generateText } from "ai";
import { AI_MODEL } from "@/lib/ai/client";
import type { CVContent, JDSummary } from "@/lib/types";

export async function generateCoverLetter(
  cv: CVContent,
  jd: JDSummary,
  jdText: string,
  ghostInstructions: string
): Promise<string> {
  const { text } = await generateText({
    model: AI_MODEL,
    prompt: [
      "Write a cover letter for this job application.",
      "",
      "Rules:",
      `- Write it in "${jd.language}" (the job description's language).`,
      "- 250-350 words, professional but warm tone, no clichés like 'I am writing to express my interest'.",
      "- Structure: hook tied to the company/role → 2 short paragraphs connecting the candidate's experience to the job's top requirements → closing with availability.",
      "- Use concrete facts from the CV below. The same truthfulness rules that produced this CV apply:",
      ghostInstructions,
      "- Output ONLY the letter body (no headers, no addresses, no 'Dear Hiring Manager' salutation in English if the letter is in Spanish — use the natural equivalent).",
      "",
      "TARGET JOB:",
      JSON.stringify(jd, null, 2),
      "",
      "FULL JOB DESCRIPTION:",
      jdText,
      "",
      "CANDIDATE CV:",
      JSON.stringify(cv, null, 2),
    ].join("\n"),
  });
  return text;
}
```

- [ ] **Step 3: Verify typecheck** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```powershell
git add lib/ai/
git commit -m "feat: add CV tailoring and cover letter generation"
```

### Task 16: Harvard PDF templates

**Files:**
- Create: `lib/pdf/harvard-cv.tsx`
- Create: `lib/pdf/cover-letter-pdf.tsx`
- Create: `app/api/pdf/[type]/[id]/route.ts`

- [ ] **Step 1: Harvard CV template** (`lib/pdf/harvard-cv.tsx`)

react-pdf components. Harvard style: Times-Roman font family (built into react-pdf), centered name (16pt bold), contact line centered (9pt, items joined by " • "), sections in this order: summary (if present), Education, Experience, Skills, Languages, Certifications. Section headers: 11pt bold uppercase with bottom border (1pt black). Experience entries: company (bold) + location (right-aligned), title (italic) + dates (right-aligned), bullets with "• " prefix, 9.5pt. A4 page, 50pt margins.

```tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CVContent } from "@/lib/types";

const styles = StyleSheet.create({
  page: { fontFamily: "Times-Roman", fontSize: 9.5, padding: 50, lineHeight: 1.35 },
  name: { fontSize: 16, fontFamily: "Times-Bold", textAlign: "center" },
  contactLine: { fontSize: 9, textAlign: "center", marginTop: 4, marginBottom: 12 },
  sectionTitle: {
    fontSize: 11, fontFamily: "Times-Bold", textTransform: "uppercase",
    borderBottomWidth: 1, borderBottomColor: "#000", marginTop: 10, marginBottom: 6, paddingBottom: 2,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontFamily: "Times-Bold" },
  italic: { fontFamily: "Times-Italic" },
  bullet: { flexDirection: "row", marginLeft: 8, marginTop: 1 },
  bulletText: { flex: 1 },
  summary: { marginBottom: 4 },
});

export function HarvardCV({ cv }: { cv: CVContent }) {
  const contactItems = [
    cv.contact.location, cv.contact.email, cv.contact.phone, cv.contact.linkedin, cv.contact.website,
  ].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{cv.contact.name}</Text>
        <Text style={styles.contactLine}>{contactItems.join("  •  ")}</Text>

        {cv.summary ? (
          <View>
            <Text style={styles.sectionTitle}>Perfil</Text>
            <Text style={styles.summary}>{cv.summary}</Text>
          </View>
        ) : null}

        {cv.education.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Educación</Text>
            {cv.education.map((edu, i) => (
              <View key={i} style={styles.row}>
                <Text>
                  <Text style={styles.bold}>{edu.institution}</Text> — {edu.degree}
                </Text>
                <Text>{[edu.start, edu.end].filter(Boolean).join(" – ")}</Text>
              </View>
            ))}
          </View>
        )}

        {cv.experience.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Experiencia</Text>
            {cv.experience.map((exp, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={styles.row}>
                  <Text style={styles.bold}>{exp.company}</Text>
                  <Text>{exp.location ?? ""}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.italic}>{exp.title}</Text>
                  <Text>
                    {exp.start} – {exp.end ?? "Presente"}
                  </Text>
                </View>
                {exp.bullets.map((b, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text>•  </Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {cv.skills.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Skills</Text>
            {cv.skills.map((group, i) => (
              <Text key={i}>
                <Text style={styles.bold}>{group.category}: </Text>
                {group.items.join(", ")}
              </Text>
            ))}
          </View>
        )}

        {cv.languages.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Idiomas</Text>
            <Text>{cv.languages.map((l) => `${l.name} (${l.level})`).join("  •  ")}</Text>
          </View>
        )}

        {cv.certifications.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Certificaciones</Text>
            {cv.certifications.map((c, i) => (
              <Text key={i}>
                {c.name}
                {c.issuer ? ` — ${c.issuer}` : ""}
                {c.year ? ` (${c.year})` : ""}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
```

**Note:** section titles ("Perfil", "Educación"...) must localize: if `cv` language is English use "Profile", "Education", "Experience", "Skills", "Languages", "Certifications". Implement as a `labels` object chosen by a `language: string` prop: `HarvardCV({ cv, language })`.

- [ ] **Step 2: Cover letter template** (`lib/pdf/cover-letter-pdf.tsx`) — same page setup; candidate name (bold, top-left), date (Spanish/English format by language), company name, then letter body paragraphs (split content on `\n\n`), closing with candidate name.

- [ ] **Step 3: PDF route handler** (`app/api/pdf/[type]/[id]/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { HarvardCV } from "@/lib/pdf/harvard-cv";
import { CoverLetterPDF } from "@/lib/pdf/cover-letter-pdf";
import type { CVContent, JDSummary } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  if (type === "cv") {
    const { data: generated } = await supabase
      .from("generated_cvs")
      .select("content, application_id, applications(company_name, position_title, jd_summary)")
      .eq("id", id)
      .single();
    if (!generated) return new NextResponse("Not found", { status: 404 });

    const cv = generated.content as CVContent;
    const jd = (generated.applications as unknown as { jd_summary: JDSummary | null })?.jd_summary;
    const buffer = await renderToBuffer(<HarvardCV cv={cv} language={jd?.language ?? "es"} />);
    const fileName = `CV - ${cv.contact.name}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  if (type === "cover-letter") {
    const { data: letter } = await supabase
      .from("cover_letters")
      .select("content, applications(company_name, jd_summary)")
      .eq("id", id)
      .single();
    if (!letter) return new NextResponse("Not found", { status: 404 });

    const app = letter.applications as unknown as { company_name: string; jd_summary: JDSummary | null };
    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("id", user.id).single();

    const buffer = await renderToBuffer(
      <CoverLetterPDF
        content={letter.content}
        candidateName={profile?.full_name ?? ""}
        companyName={app.company_name}
        language={app.jd_summary?.language ?? "es"}
      />
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Cover Letter - ${app.company_name}.pdf"`,
      },
    });
  }

  return new NextResponse("Invalid type", { status: 400 });
}
```

**Note:** route handlers with JSX need the file extension `.tsx`: name the file `route.tsx` NOT `route.ts` (Next.js accepts both). RLS guarantees the user only reads their own rows — no extra ownership check needed.

- [ ] **Step 4: Manual verification deferred to Task 17** (needs UI to trigger generation first).

- [ ] **Step 5: Commit**

```powershell
git add lib/pdf app/api/pdf
git commit -m "feat: add Harvard CV and cover letter PDF templates with download route"
```

### Task 17: Tailoring UI — ghost slider + generation panel

**Files:**
- Create: `components/ghost-slider.tsx`
- Create: `app/(app)/applications/[id]/actions.ts`
- Modify: `app/(app)/applications/[id]/page.tsx` (replace placeholder cards)
- Create: `components/cv-preview.tsx` (if not created in Task 7)

- [ ] **Step 1: Ghost slider component** (`components/ghost-slider.tsx`)

Client component. shadcn `Slider` (0-100, step 1) + live label that changes with the band: "Honesto" (0-25, green text), "Maquillado" (26-50, yellow), "Fantasma" (51-75, orange), "Fantasma total" (76-100, red) + ghost emoji that grows with the level (text-base → text-lg → text-xl → text-2xl). Below, a one-line description of what the current band does (Spanish, from a `BAND_DESCRIPTIONS` record). Props: `{ value: number; onChange: (v: number) => void }`.

Band descriptions (Spanish):
- honesto: "Solo reordena y enfatiza lo que ya está en tu CV."
- maquillado: "Estira la terminología: lo que tocaste alguna vez aparece como experiencia."
- fantasma: "Infla seniority y suma responsabilidades plausibles."
- fantasma_total: "Estiramiento máximo defendible. Nunca inventa títulos, empresas ni fechas."

- [ ] **Step 2: Server actions** (`app/(app)/applications/[id]/actions.ts`)

- `generateTailoredCV({ applicationId, baseCvId, ghostLevel })`: auth check → fetch base CV content + application JD → call `tailorCV` → insert `generated_cvs` row → add `cv_generated` event ("CV generado", description: `Nivel de fantasmeo: ${ghostLevel}`) → revalidate → return generated CV id.
- `generateCoverLetterAction({ applicationId, generatedCvId | baseCvId })`: fetch CV content (generated if available, else base) + JD → `getGhostInstructions(ghostLevel of the generated CV, or 0)` → call `generateCoverLetter` → insert `cover_letters` row → add event → revalidate → return id.
- `updateGeneratedCV({ id, content })`: zod-validate with `cvContentSchema` → update row.
- `updateCoverLetter({ id, content })`: update text.

- [ ] **Step 3: Wire into detail page**

Right column becomes two cards:

**Card "CV adaptado":** if no generated CV → base CV select (if >1) + GhostSlider + "Generar CV" button (loading state: "Fantasmeando... 👻"). If generated CV(s) exist → tabs per generation (most recent first, label: ghost band + date) showing `CVPreview` (read-only render of CVContent), "Editar" toggle that swaps in `CVEditor` wired to `updateGeneratedCV`, "Descargar PDF" button → `/api/pdf/cv/{id}`, and a "Generar otra versión" collapsible with slider + button.

**Card "Cover letter":** if none → "Generar cover letter" button (uses most recent generated CV, or base CV if none). If exists → letter text in a styled read view, "Editar" toggle (textarea + save), "Descargar PDF" → `/api/pdf/cover-letter/{id}`, "Regenerar" button.

**Error handling (both cards):** generation actions can fail (AI Gateway down, rate limit). Wrap calls in try/catch in the client component → on error show a destructive sonner toast "No se pudo generar, probá de nuevo" and re-enable the button (which acts as the retry). No automatic retry loops.

- [ ] **Step 4: Manual verification** — full flow with real AI: open application → move slider to 80 → generate CV → verify content is stretched but employers/dates match base CV → download PDF, open it, verify Harvard layout → generate cover letter → download its PDF. Then regenerate at level 0 and verify the difference.

- [ ] **Step 5: Commit**

```powershell
git add app/ components/
git commit -m "feat: add CV tailoring UI with ghost slider and cover letter panel"
```

### Task 18: Phase 3 checkpoint

- [ ] **Step 1:** `npx vitest run` + `npm run build` + `npx tsc --noEmit` → all green. Fix and commit if not.
- [ ] **Step 2:** Tag: `git tag phase-3-ai-generation`

---

## Phase 4: Gmail Integration

### Task 19: Token encryption module

**Files:**
- Create: `lib/gmail/crypto.ts`
- Test: `tests/crypto.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/crypto.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/lib/gmail/crypto";

beforeAll(() => {
  // 32 bytes hex = 64 chars
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("encrypt/decrypt", () => {
  it("round-trips a token", () => {
    const token = "ya29.a0AfH6SMBx-secret-token-value";
    const encrypted = encrypt(token);
    expect(encrypted).not.toContain(token);
    expect(decrypt(encrypted)).toBe(token);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const token = "same-input";
    expect(encrypt(token)).not.toBe(encrypt(token));
  });

  it("throws when decrypting tampered data", () => {
    const encrypted = encrypt("token");
    const tampered = encrypted.slice(0, -4) + "0000";
    expect(() => decrypt(tampered)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/crypto.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (`lib/gmail/crypto.ts`)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Output format: base64(iv):base64(authTag):base64(ciphertext)
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/crypto.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/gmail/crypto.ts tests/crypto.test.ts
git commit -m "feat: add AES-256-GCM token encryption"
```

### Task 20: Gmail OAuth flow

**Files:**
- Create: `lib/gmail/oauth.ts`
- Create: `app/api/gmail/oauth/connect/route.ts`
- Create: `app/api/gmail/oauth/callback/route.ts`

**Prerequisite (manual, document in README):** Google Cloud project → enable Gmail API → OAuth consent screen (External, Testing mode, add owner + invitee emails as test users) → OAuth client ID (Web application) with authorized redirect URI `{NEXT_PUBLIC_APP_URL}/api/gmail/oauth/callback` (both localhost and production URL).

- [ ] **Step 1: OAuth client factory** (`lib/gmail/oauth.ts`)

```typescript
import { google } from "googleapis";

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function createOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/oauth/callback`
  );
}
```

- [ ] **Step 2: Connect route** (`app/api/gmail/oauth/connect/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOAuthClient, GMAIL_SCOPES } from "@/lib/gmail/oauth";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const oauth = createOAuthClient();
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token issuance every time
    scope: GMAIL_SCOPES,
    state: user.id,
  });

  return NextResponse.redirect(url);
}
```

- [ ] **Step 3: Callback route** (`app/api/gmail/oauth/callback/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createOAuthClient } from "@/lib/gmail/oauth";
import { encrypt } from "@/lib/gmail/crypto";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // state must match the logged-in user (CSRF protection)
  if (!user || !code || state !== user.id) {
    return NextResponse.redirect(`${origin}/settings?gmail=error`);
  }

  const oauth = createOAuthClient();
  const { tokens } = await oauth.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.redirect(`${origin}/settings?gmail=error`);
  }

  // Get the Gmail address this token belongs to
  oauth.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oauth });
  const profile = await gmail.users.getProfile({ userId: "me" });

  await supabase.from("gmail_connections").upsert(
    {
      user_id: user.id,
      email_address: profile.data.emailAddress!,
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      status: "active",
    },
    { onConflict: "user_id" }
  );

  return NextResponse.redirect(`${origin}/settings?gmail=connected`);
}
```

- [ ] **Step 4: Manual verification** — needs Google Cloud OAuth client configured. From Settings (Task 22 builds the button; for now visit `/api/gmail/oauth/connect` directly) → consent → redirected to settings → check `gmail_connections` row exists with encrypted tokens.

- [ ] **Step 5: Commit**

```powershell
git add lib/gmail app/api/gmail
git commit -m "feat: add Gmail OAuth connect and callback flow"
```

### Task 21: Gmail sync — prefilter, AI matching, cron endpoint

**Files:**
- Create: `lib/gmail/prefilter.ts`
- Create: `lib/ai/match-email.ts`
- Create: `lib/gmail/sync.ts`
- Create: `app/api/cron/gmail-sync/route.ts`
- Test: `tests/prefilter.test.ts`

- [ ] **Step 1: Write failing prefilter tests**

`tests/prefilter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isLikelyRelevant } from "@/lib/gmail/prefilter";

const applications = [
  { id: "1", company_name: "Globant", position_title: "Backend Developer" },
  { id: "2", company_name: "MercadoLibre", position_title: "SSr Engineer" },
];

describe("isLikelyRelevant", () => {
  it("accepts an email mentioning a tracked company in the sender", () => {
    expect(
      isLikelyRelevant(
        { from: "talent@globant.com", subject: "Your application", body: "Hi! Thanks for applying" },
        applications
      )
    ).toBe(true);
  });

  it("accepts an email mentioning a tracked company in the subject", () => {
    expect(
      isLikelyRelevant(
        { from: "noreply@greenhouse.io", subject: "Update on your MercadoLibre application", body: "..." },
        applications
      )
    ).toBe(true);
  });

  it("accepts recruiting-platform senders even without a company match", () => {
    expect(
      isLikelyRelevant(
        { from: "jobs-noreply@linkedin.com", subject: "Your application was viewed", body: "..." },
        applications
      )
    ).toBe(true);
  });

  it("rejects newsletters and unrelated email", () => {
    expect(
      isLikelyRelevant(
        { from: "newsletter@medium.com", subject: "Top 10 articles this week", body: "..." },
        applications
      )
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run tests/prefilter.test.ts` → FAIL.

- [ ] **Step 3: Implement prefilter** (`lib/gmail/prefilter.ts`)

```typescript
interface EmailSummary {
  from: string;
  subject: string;
  body: string;
}

interface TrackedApplication {
  id: string;
  company_name: string;
  position_title: string;
}

// Senders from recruiting platforms are always relevant candidates
const RECRUITING_DOMAINS = [
  "linkedin.com", "greenhouse.io", "lever.co", "workday.com", "myworkday.com",
  "smartrecruiters.com", "ashbyhq.com", "breezy.hr", "bamboohr.com",
  "indeed.com", "glassdoor.com", "talent.com", "workable.com", "icims.com",
  "jobvite.com", "recruitee.com", "teamtailor.com", "personio.de", "personio.com",
];

function normalize(s: string): string {
  // strip combining diacritical marks (U+0300–U+036F) after NFD decomposition
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function isLikelyRelevant(
  email: EmailSummary,
  applications: TrackedApplication[]
): boolean {
  const haystack = normalize(`${email.from} ${email.subject} ${email.body.slice(0, 2000)}`);
  const fromDomain = email.from.split("@").pop() ?? "";

  if (RECRUITING_DOMAINS.some((domain) => fromDomain.includes(domain))) {
    return true;
  }

  return applications.some((app) => {
    const company = normalize(app.company_name);
    // company name as a word (avoid "meta" matching "metadata")
    const companyRegex = new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return companyRegex.test(haystack);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass** — `npx vitest run tests/prefilter.test.ts` → PASS (4 tests).

- [ ] **Step 5: Implement AI email matching** (`lib/ai/match-email.ts`)

```typescript
import { generateObject } from "ai";
import { emailMatchResultSchema } from "@/lib/schemas";
import { AI_MODEL } from "@/lib/ai/client";
import type { EmailMatchResult } from "@/lib/types";

interface ApplicationContext {
  id: string;
  company_name: string;
  position_title: string;
  platform: string;
  status: string;
  applied_at: string | null;
}

export async function matchEmail(
  email: { from: string; subject: string; body: string; receivedAt: string },
  applications: ApplicationContext[]
): Promise<EmailMatchResult> {
  const { object } = await generateObject({
    model: AI_MODEL,
    schema: emailMatchResultSchema,
    prompt: [
      "You are matching an incoming email against a list of job applications the user is tracking.",
      "",
      "Determine:",
      "1. Which application (if any) this email is about. Return its id, or null if none match.",
      "2. Your confidence (0-1). Use >0.8 only when the company or position is explicitly referenced.",
      "3. The classification:",
      "   - 'rejection': the email rejects the candidate",
      "   - 'interview': invitation to interview, screening call, or technical test",
      "   - 'offer': a job offer or contract discussion",
      "   - 'info_request': recruiter asks for documents, availability, salary expectations, etc.",
      "   - 'other': related to the application but none of the above",
      "4. A one-line summary IN SPANISH of what the email says (for the application timeline).",
      "",
      "Important: automated marketing from job platforms ('jobs you may like') is NOT about a specific application — return null with classification 'other'.",
      "",
      "TRACKED APPLICATIONS:",
      JSON.stringify(applications, null, 2),
      "",
      "EMAIL:",
      JSON.stringify(email, null, 2),
    ].join("\n"),
  });
  return object;
}
```

- [ ] **Step 6: Implement sync orchestration** (`lib/gmail/sync.ts`)

```typescript
import { google, type gmail_v1 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOAuthClient } from "@/lib/gmail/oauth";
import { decrypt, encrypt } from "@/lib/gmail/crypto";
import { isLikelyRelevant } from "@/lib/gmail/prefilter";
import { matchEmail } from "@/lib/ai/match-email";

const ACTIVE_STATUSES = ["applied", "response_received", "interview", "offer"];
const HIGH_CONFIDENCE = 0.8;
const MIN_CONFIDENCE = 0.5;

interface GmailConnection {
  id: string;
  user_id: string;
  email_address: string;
  access_token_enc: string;
  refresh_token_enc: string;
  last_sync_at: string | null;
}

interface SyncResult {
  connectionId: string;
  scanned: number;
  matched: number;
  pendingReview: number;
  error?: string;
}

function getHeader(message: gmail_v1.Schema$Message, name: string): string {
  return (
    message.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function getBody(message: gmail_v1.Schema$Message): string {
  // Prefer text/plain part; fall back to snippet
  function findPlainText(part: gmail_v1.Schema$MessagePart | undefined): string | null {
    if (!part) return null;
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    for (const child of part.parts ?? []) {
      const found = findPlainText(child);
      if (found) return found;
    }
    return null;
  }
  return findPlainText(message.payload) ?? message.snippet ?? "";
}

export async function syncConnection(
  admin: SupabaseClient,
  connection: GmailConnection
): Promise<SyncResult> {
  const result: SyncResult = {
    connectionId: connection.id,
    scanned: 0,
    matched: 0,
    pendingReview: 0,
  };

  // 1. Set up authenticated Gmail client
  const oauth = createOAuthClient();
  oauth.setCredentials({
    access_token: decrypt(connection.access_token_enc),
    refresh_token: decrypt(connection.refresh_token_enc),
  });

  // Persist refreshed access tokens
  oauth.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await admin
        .from("gmail_connections")
        .update({
          access_token_enc: encrypt(tokens.access_token),
          token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        })
        .eq("id", connection.id);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth });

  // 2. Get the user's active applications
  const { data: applications } = await admin
    .from("applications")
    .select("id, company_name, position_title, platform, status, applied_at")
    .eq("user_id", connection.user_id)
    .in("status", ACTIVE_STATUSES);

  if (!applications || applications.length === 0) {
    return result; // nothing to match against
  }

  // 3. List messages since last sync (default: last 3 days on first sync)
  const sinceDate = connection.last_sync_at
    ? new Date(connection.last_sync_at)
    : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const query = `in:inbox after:${Math.floor(sinceDate.getTime() / 1000)}`;

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messageRefs = listResponse.data.messages ?? [];
  result.scanned = messageRefs.length;

  // 4. Process each message
  for (const ref of messageRefs) {
    // Skip already-processed messages
    const { data: existing } = await admin
      .from("matched_emails")
      .select("id")
      .eq("user_id", connection.user_id)
      .eq("gmail_message_id", ref.id!)
      .maybeSingle();
    if (existing) continue;

    const { data: message } = await gmail.users.messages.get({
      userId: "me",
      id: ref.id!,
      format: "full",
    });

    const from = getHeader(message, "From");
    const subject = getHeader(message, "Subject");
    const body = getBody(message);
    const receivedAt = new Date(Number(message.internalDate)).toISOString();

    // 5. Cheap prefilter before spending AI tokens
    if (!isLikelyRelevant({ from, subject, body }, applications)) continue;

    // 6. AI matching
    const match = await matchEmail({ from, subject, body, receivedAt }, applications);

    if (!match.application_id || match.confidence < MIN_CONFIDENCE) continue;

    const isAutoMatch = match.confidence >= HIGH_CONFIDENCE;

    // 7. Store the matched email
    const { data: storedEmail } = await admin
      .from("matched_emails")
      .insert({
        user_id: connection.user_id,
        application_id: match.application_id,
        gmail_message_id: ref.id!,
        gmail_thread_id: message.threadId,
        from_address: from,
        subject,
        snippet: message.snippet,
        body_text: body.slice(0, 10000),
        received_at: receivedAt,
        match_confidence: match.confidence,
        match_status: isAutoMatch ? "auto_matched" : "pending_review",
        ai_classification: match,
      })
      .select("id")
      .single();

    if (isAutoMatch && storedEmail) {
      result.matched++;
      // 8. Add timeline event
      await admin.from("application_events").insert({
        application_id: match.application_id,
        user_id: connection.user_id,
        type: "email_received",
        title: classificationTitle(match.classification),
        description: match.summary,
        email_id: storedEmail.id,
        metadata: { from, subject, classification: match.classification },
      });

      // 9. Suggest status change
      const newStatus = suggestedStatus(match.classification);
      if (newStatus) {
        await admin
          .from("applications")
          .update({ status: newStatus })
          .eq("id", match.application_id)
          .in("status", ACTIVE_STATUSES); // never downgrade terminal states
      }
    } else {
      result.pendingReview++;
    }
  }

  // 10. Update last sync timestamp
  await admin
    .from("gmail_connections")
    .update({ last_sync_at: new Date().toISOString(), status: "active" })
    .eq("id", connection.id);

  return result;
}

function classificationTitle(classification: string): string {
  switch (classification) {
    case "rejection": return "Rechazo recibido";
    case "interview": return "Invitación a entrevista";
    case "offer": return "¡Oferta recibida!";
    case "info_request": return "Pedido de información";
    default: return "Respuesta recibida";
  }
}

function suggestedStatus(classification: string): string | null {
  switch (classification) {
    case "rejection": return "rejected";
    case "interview": return "interview";
    case "offer": return "offer";
    case "info_request": return "response_received";
    default: return "response_received";
  }
}
```

- [ ] **Step 7: Implement cron endpoint** (`app/api/cron/gmail-sync/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncConnection } from "@/lib/gmail/sync";

export const maxDuration = 300; // Fluid Compute allows up to 300s on Hobby

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connections } = await admin
    .from("gmail_connections")
    .select("id, user_id, email_address, access_token_enc, refresh_token_enc, last_sync_at")
    .eq("status", "active");

  const results = [];
  for (const connection of connections ?? []) {
    try {
      results.push(await syncConnection(admin, connection));
    } catch (error) {
      // Per-connection isolation: one failing connection never blocks the others
      await admin
        .from("gmail_connections")
        .update({ status: "error" })
        .eq("id", connection.id);
      results.push({
        connectionId: connection.id,
        scanned: 0,
        matched: 0,
        pendingReview: 0,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
```

- [ ] **Step 8: Run all tests + typecheck** — `npx vitest run` and `npx tsc --noEmit` → green.

- [ ] **Step 9: Commit**

```powershell
git add lib/ app/api/cron tests/
git commit -m "feat: add Gmail sync with prefilter, AI matching, and cron endpoint"
```

### Task 22: Settings — Gmail panel, email review, profile, invites

**Files:**
- Create: `app/(app)/settings/page.tsx` (replace placeholder)
- Create: `app/(app)/settings/actions.ts`
- Create: `components/email-review-card.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (add pending-review section placeholder for Task 23)

- [ ] **Step 1: Settings actions** (`app/(app)/settings/actions.ts`)

- `updateProfile({ fullName, phone, location, linkedinUrl })`: zod validate → update `profiles`.
- `disconnectGmail()`: delete `gmail_connections` row for user.
- `addInvite({ email })`: zod validate (email) → insert into `invites`.
- `confirmEmailMatch({ emailId, confirm })`: if confirm → update `matched_emails.match_status = 'confirmed'` + create `email_received` event (same logic as auto-match in sync.ts: title from classification, description from summary) + suggested status change. If not → `match_status = 'rejected'`, set `application_id = null`.

- [ ] **Step 2: Settings page** — three cards:
  1. **Perfil:** form with full_name, phone, location, linkedin_url → `updateProfile`.
  2. **Gmail:** if no connection → explanation text + "Conectar Gmail" button (link to `/api/gmail/oauth/connect`). If connected → email address, last sync time ("Última sincronización: hace X min"), status badge, "Desconectar" button. If status=error → red alert "La conexión expiró, reconectá tu cuenta".
  3. **Invitaciones:** list of invites (email, used/pending badge) + add-invite input → `addInvite`.

Handle `?gmail=connected` / `?gmail=error` query params with sonner toasts.

- [ ] **Step 3: Email review card component** (`components/email-review-card.tsx`)

Props: `{ email: MatchedEmail; applicationLabel: string }`. Shows: from, subject, snippet, AI classification badge, suggested application, confidence %. Buttons: "Sí, es de esta postulación" → `confirmEmailMatch({ confirm: true })`, "No" → `confirmEmailMatch({ confirm: false })`.

- [ ] **Step 4: Manual verification** — connect real Gmail → trigger sync manually with PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cron/gmail-sync" -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
```

Verify: emails appear in `matched_emails`, timeline events created for high-confidence matches, pending ones show review cards.

- [ ] **Step 5: Commit**

```powershell
git add app/ components/
git commit -m "feat: add settings page with Gmail connection, invites, and email review"
```

### Task 23: Phase 4 checkpoint

- [ ] **Step 1:** `npx vitest run` + `npm run build` + `npx tsc --noEmit` → all green. Fix and commit if not.
- [ ] **Step 2:** Tag: `git tag phase-4-gmail`

---

## Phase 5: Dashboard, Docs & Handoff

### Task 24: Dashboard

**Files:**
- Modify: `app/(app)/dashboard/page.tsx` (replace placeholder)

- [ ] **Step 1: Dashboard page** — server component, parallel queries (`Promise.all`):

1. **Stat cards row:** Postulaciones activas (status in applied/response_received/interview/offer), Esperando respuesta (applied), Entrevistas (interview), Ghosteadas 👻 (ghosted).
2. **"Para revisar" section:** matched_emails with `match_status = 'pending_review'` → `EmailReviewCard` list. Hidden if empty.
3. **"Actividad reciente" section:** last 15 application_events across all applications (join company/position), rendered with the Timeline component, each linking to its application.
4. **Empty state** (no applications yet): onboarding checklist card — "1. Subí tu CV → 2. Cargá tu primera postulación → 3. Conectá tu Gmail" with links.

- [ ] **Step 2: Manual verification** — dashboard shows correct counts and recent events from test data.

- [ ] **Step 3: Commit**

```powershell
git add app/
git commit -m "feat: add dashboard with stats, email review, and activity feed"
```

### Task 25: Ghosted auto-detection (cron bonus)

**Files:**
- Modify: `app/api/cron/gmail-sync/route.ts`

- [ ] **Step 1: Add ghosted detection to the cron** — after syncing connections, run one query: applications with `status = 'applied'` and `applied_at < now() - interval '21 days'` and no `email_received` events → update status to `ghosted` + add `status_changed` event ("Marcada como ghosteada 👻", "21 días sin respuesta").

```typescript
// In the POST handler, after the connections loop:
const GHOSTED_AFTER_DAYS = 21;
const cutoff = new Date(Date.now() - GHOSTED_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

const { data: staleApps } = await admin
  .from("applications")
  .select("id, user_id")
  .eq("status", "applied")
  .lt("applied_at", cutoff);

for (const app of staleApps ?? []) {
  await admin.from("applications").update({ status: "ghosted" }).eq("id", app.id);
  await admin.from("application_events").insert({
    application_id: app.id,
    user_id: app.user_id,
    type: "status_changed",
    title: "Marcada como ghosteada 👻",
    description: `${GHOSTED_AFTER_DAYS} días sin respuesta`,
    metadata: { new_status: "ghosted", auto: true },
  });
}
```

- [ ] **Step 2: Commit**

```powershell
git add app/api/cron
git commit -m "feat: auto-mark applications as ghosted after 21 days without response"
```

### Task 26: README and deployment docs

**Files:**
- Create: `README.md` (replace scaffold default)

- [ ] **Step 1: Write README.md** with these sections (English):

1. **Fantasmeo** — one-paragraph description + feature list.
2. **Stack** — table of technologies.
3. **Local development** — prerequisites (Node 20+), `npm install`, `.env.local` setup (table of every env var from Shared Contracts with how to obtain each), `npm run dev`.
4. **Supabase setup** — create project, apply migrations (in order, via SQL editor or MCP), configure Google auth provider, where to find URL/keys.
5. **Google Cloud setup** — create project, enable Gmail API, OAuth consent screen (Testing mode + test users), create TWO OAuth clients or one with both redirect URIs: Supabase auth callback + app Gmail callback. Exact redirect URIs listed.
6. **Vercel deployment** — connect GitHub repo, set env vars (table), `NEXT_PUBLIC_APP_URL` = production URL. Note about AI Gateway: enable in Vercel dashboard → AI tab.
7. **pg_cron setup** — apply `00004_pg_cron.sql.example` with real values after first deploy.
8. **Architecture** — short overview + link to spec/plan docs.

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: add README with setup and deployment guide"
```

### Task 27: Final verification and handoff

- [ ] **Step 1:** Full check: `npx vitest run` + `npm run build` + `npx tsc --noEmit` → all green.
- [ ] **Step 2:** Manual smoke test of complete happy path: login → upload CV → create application → tailor CV (slider 70) → download PDF → generate cover letter → connect Gmail → trigger sync → check dashboard.
- [ ] **Step 3:** `git tag v0.1.0`
- [ ] **Step 4:** Tell the user:
  - How to create the GitHub repo and push (`gh repo create fantasmeo --private --source . --push` or manual).
  - How to connect it to Vercel (import project → set env vars → deploy).
  - The manual setup steps that remain: Supabase Google provider, Google Cloud OAuth, pg_cron with production URL, Vercel AI Gateway enablement.

---

## Execution notes

- **Real credentials needed at:** Task 3 (Supabase project), Task 5 manual verification (Google sign-in), Task 7 manual verification (AI Gateway key), Task 20+ (Google Cloud OAuth client). Code can always be written and unit-tested without them; only manual verification steps block on credentials.
- **Order constraints:** Tasks 1→8 sequential. Tasks 9, 10, 14, 19 are independent of each other (parallelizable after Task 8). Task 11 needs 9+10. Task 12 needs 11. Task 15 needs 14. Task 16 needs 2. Task 17 needs 15+16. Tasks 20-21 need 19. Task 22 needs 21. Tasks 24-27 need everything before them.

---

## Plan deviations (discovered during execution)

### Deviation 1: invites table is service-role-only (security fix, 2026-06-01)

Code review of Task 3 found that the original invites RLS policies (any authenticated user can insert/update) allow an uninvited user to forge an invite for themselves before the invite gate signs them out, bypassing the gate entirely.

**Change:** `00002_rls.sql` defines NO policies for `invites` (deny-all for clients). All invite operations go through the service-role client:

- **Task 5 (auth callback):** the invite gate must use `createAdminClient()` (not the session client) to read invites and mark `used_at`.
- **Task 22 (settings):** `addInvite` and the invites list must use `createAdminClient()` after verifying the logged-in user is the owner (`user.email === process.env.OWNER_EMAIL`).

Additionally, all `auth.uid()` calls in RLS policies are wrapped as `(select auth.uid())` (Supabase performance best practice), and two FK indexes were added (`application_events.email_id`, `generated_cvs.base_cv_id`).
- **AI calls in dev:** every AI function reads `AI_GATEWAY_API_KEY` from env. Get one at vercel.com → AI Gateway → API keys (free tier available).
