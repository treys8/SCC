# Starkville Country Club — Member Portal

A members-only portal for Starkville Country Club: announcements, dining/facility
reservations, and the club calendar.

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Storage), secured with Row-Level Security
- **Hosting:** Vercel (frontend) + Supabase (backend)

## Features

| Area | Members | Staff | Admin |
| --- | --- | --- | --- |
| Announcements (by department) | Read | Create / edit / delete own | Create / edit / delete own |
| Reservations | Request + cancel own | Confirm / cancel all | Confirm / cancel all |
| Calendar / events | Read | Create / edit / delete | Create / edit / delete |
| Members & roles | — | — | Invite + assign roles |

Onboarding is **invite-only** — there is no public sign-up. Admins invite members
by email; new accounts default to the `member` role.

---

## Getting started

### 1. Prerequisites

- Node.js **20+** (an `.nvmrc` is included — run `nvm use`)
- A Supabase project (free tier is fine)

### 2. Install

```bash
nvm use            # or ensure Node >= 20
npm install
```

### 3. Apply the database schema

Open the Supabase **SQL Editor** and run the migration in
[`supabase/migrations/20260607000000_init.sql`](supabase/migrations/20260607000000_init.sql).
It is idempotent — safe to run more than once. It creates the tables, enums,
RLS policies, triggers, and the public `posts` storage bucket.

> Using the Supabase CLI instead? `supabase link` then `supabase db push`.

### 4. Configure environment variables

Copy the example and fill in values from **Supabase → Project Settings → API**:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` / secret key | **Server-only.** Bypasses RLS; used for member invites. Never expose to the browser. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally | Used to build auth callback links |

### 5. Configure Supabase Auth

In **Supabase → Authentication**:

1. **URL Configuration**
   - **Site URL:** `http://localhost:3000` (and your Vercel URL in production)
   - **Redirect URLs:** add `http://localhost:3000/auth/callback` and
     `https://<your-app>.vercel.app/auth/callback`
2. **Providers → Email:** turn **OFF** "Allow new users to sign up"
   (this enforces invite-only; admins still invite via the service-role key).
3. **(Production)** configure custom SMTP — the built-in email sender is
   rate-limited and meant for testing.

### 6. Create the first admin

Because onboarding is invite-only, bootstrap the first admin manually:

1. In **Supabase → Authentication → Users**, click **Add user** (or **Invite**)
   and create your own account. The `handle_new_user` trigger creates a matching
   `profiles` row with role `member`.
2. In the **SQL Editor**, promote yourself:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

3. Sign in. You can now invite everyone else from **Members** in the app.

### 7. Run

```bash
npm run dev
```

Visit http://localhost:3000.

---

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the four environment variables (set `NEXT_PUBLIC_SITE_URL` to your
   production URL, e.g. `https://scc.vercel.app`).
3. Add the production `/auth/callback` URL to Supabase Redirect URLs (step 5).
4. Deploy. Vercel uses Node 20+ automatically.

---

## Project structure

```
src/
  app/
    (app)/              # authenticated portal (nav + auth guard)
      page.tsx          # dashboard
      posts/            # announcements (feed, new, edit) + actions
      reservations/     # member booking + staff queue + actions
      calendar/         # events (list, new, edit) + actions
      members/          # admin: invite + roles + actions
      profile/          # edit own profile
    login/              # public sign-in
    set-password/       # invited members set a password
    auth/callback/      # exchanges auth-email tokens for a session
  components/           # UI: nav, cards, forms, badges, tables
  lib/
    supabase/           # browser / server / admin clients + session proxy
    auth.ts             # getUser / getProfile / requireRole helpers
    constants.ts format.ts cn.ts database.types.ts
  proxy.ts              # Next 16 middleware: refreshes session, guards routes
supabase/
  migrations/           # the schema (run in SQL Editor or via CLI)
```

## Security notes

- **RLS everywhere.** Every table enforces row-level access; the service-role key
  is only used server-side for admin invites and role changes.
- **Role escalation is blocked.** A database trigger (`enforce_role_change`)
  prevents members from promoting themselves — only admins (or trusted
  server-side code) can change a role.
- Roles are read from the `profiles` table via a `SECURITY DEFINER` helper that
  only ever returns the caller's own role.
