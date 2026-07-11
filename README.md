# EduLedger API

The backend for the EduLedger prototypes — a Next.js (App Router) API deployed on Vercel, backed by Supabase (Postgres + Auth), with Groq powering weekend-quiz auto-generation.

**Status:** this has been built and tested against a real (local) Postgres instance running the actual migration and RLS policies — see "What's been verified" below. It has **not** been tested against a live Supabase project, Groq account, or Paystack account, because doing so needs your real API keys. Budget an afternoon to wire those up and smoke-test each route before pointing it at a real school's data.

---

## 1. Stack

| Piece | Choice | Why |
|---|---|---|
| Hosting | **Vercel** | Zero-config deploys straight from GitHub; Next.js API routes run as serverless functions |
| Database + Auth | **Supabase** | Hosted Postgres with the exact Row-Level Security model this schema depends on, plus built-in auth (staff email/password, parents via magic link) |
| AI | **Groq** | Fast enough inference that "auto-generate a quiz" feels instant rather than a loading spinner — used only for the weekend quiz feature |
| Repo/CI | **GitHub** | Source of truth; connect the repo to Vercel for auto-deploy on push |
| Payments | Paystack (swap for Flutterwave/MoMo) | Webhook signature verification is real; the actual merchant account is yours to create |

---

## 2. One-time setup

### GitHub
1. Create a new repo, push this folder to it.
2. In Vercel, "Import Project" → pick the repo → it auto-detects Next.js.

### Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run these in order — each depends on the last:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_profiles_rls.sql`
   - `supabase/migrations/0003_remaining_rls.sql`
   - `supabase/migrations/0004_transport_parent_request.sql`
   - `supabase/migrations/0005_permissions_and_quiz_taking.sql`
   - `supabase/migrations/0006_setup_write_policies.sql`
   - `supabase/migrations/0007_quiz_write_policies.sql`
   - Do **not** run `0000_local_auth_stub_TEST_ONLY.sql` — that file only exists so these migrations could be tested against plain PostgreSQL locally (Supabase already provides a real `auth` schema).
3. Settings → API: copy the Project URL and anon key into `.env.local` (see `.env.example`).
4. Settings → API → service role key: copy into `SUPABASE_SERVICE_ROLE_KEY`. **Never** expose this to the browser or commit it — it bypasses every RLS policy in the schema.
5. Seed at least one tenant/branch/profile row (Table Editor or SQL) to have something to test against — see the worked example in §5 below.

### Groq
1. Create a key at [console.groq.com/keys](https://console.groq.com/keys).
2. Drop it into `GROQ_API_KEY`.
3. Model note: `src/lib/groq.ts` defaults to `openai/gpt-oss-20b`. Groq periodically deprecates older Llama models (this already happened once to `llama-3.1-8b-instant`/`llama-3.3-70b-versatile` during this project) — check [console.groq.com/docs/models](https://console.groq.com/docs/models) before you deploy and update `GROQ_MODEL` in your environment if needed, rather than editing code.

### Paystack (or your chosen processor)
1. Get your secret key from the Paystack dashboard, put it in `PAYSTACK_SECRET_KEY`.
2. Point Paystack's webhook URL at `https://<your-vercel-domain>/api/payments/webhook`.
3. When you create a payment on the frontend, put the invoice's UUID in `metadata.invoice_id` — the webhook reads it from there to know which invoice to credit.

### Vercel environment variables
Add every variable from `.env.example` to the Vercel project (Settings → Environment Variables) for Production, Preview, and Development.

---

## 3. Running locally

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

`npm run build` (or `npm run typecheck`) will catch most integration mistakes before you deploy — both were run against this exact codebase during development.

---

## 4. What's been verified vs. what hasn't

**Verified, against a real local PostgreSQL 16 instance standing in for Supabase** (auth.users/auth.uid() stubbed — see §2):
- The full migration (`0001` → `0002` → `0003`) applies cleanly, end to end, in order.
- The teacher-submits → head-teacher-approves → parent-sees-only-approved workflow was run as actual SQL, as three different simulated users, and behaved exactly as designed — including that a class teacher's attempt to approve/reject a score is correctly blocked by RLS, not just by UI convention.
- **Two real security gaps were found by testing, not by re-reading the schema, and both are fixed:**
  1. `0001`'s first draft had `students` and `guardians` RLS policies referencing each other — Postgres correctly refused this as infinite recursion. Fixed in `0001` with `SECURITY DEFINER` helper functions (`student_is_visible`, `score_is_visible`).
  2. `profiles` and 13 other tables (`subjects`, `terms`, `branches`, `tenants`, `fee_items`, `transport_routes`, `audit_log`, etc.) were **never RLS-enabled at all** in the first draft — meaning any authenticated user, from any school, could read every other school's staff list and configuration data. Found while wiring the frontend pages (a route needed to query `profiles` and the gap became obvious). Fixed in `0002` and `0003`, and re-verified with a two-tenant test: a Golden Crest teacher cannot see Rival Academy's subjects, branch, or tenant row; public holidays remain visible to everyone since they're genuinely non-tenant data.
  3. The `profiles` self-update policy's own `WITH CHECK` clause initially queried `profiles` directly and hit the same recursion problem as #1 — fixed the same way, with a `SECURITY DEFINER` helper (`auth_own_branch_id`), and re-verified that self-promotion is blocked cleanly (not via a recursion crash) while legitimate contact-info edits still succeed.
- Every route handler and page type-checks (`tsc --noEmit`).
- `next build` compiles clean for the **whole project including the frontend pages** — this caught a real Next.js requirement (`useSearchParams()` must be wrapped in `<Suspense>`) that failed the first build attempt and was fixed.
- The `pdf-lib` drawing calls used in the report-card route (rectangles, circles, embedded fonts, positioned text) were smoke-tested in isolation and produce a valid PDF.

**Not verified, and worth doing before going live:**
- No route or page has been called against a real deployed Supabase project — the RLS logic is proven correct in Postgres, but the actual Supabase Auth flow (session cookies, `auth.users` behavior, magic links) can only be tested against a real project.
- The Groq call in `src/lib/groq.ts` has not been run against a real Groq API key.
- The Paystack webhook signature verification logic is standard HMAC-SHA512 per Paystack's documented scheme, but hasn't received an actual signed webhook from Paystack's servers.
- No automated test suite (Jest/Vitest) exists yet — the testing done here was manual, targeted SQL and manual `tsc`/`next build` runs, not repeatable CI checks.
- No load testing, rate limiting, or abuse protection on any route.
- `subjects_read`-style policies added in `0003` cover reads only — nobody can currently create a subject, term, or fee item through the API (no POST routes exist for them yet); a school's initial setup would need to go through the Supabase Table Editor or a seed script until those exist.

**Two more real gaps found and fixed while building the Owner/Fees/Transport pages:**
4. `transport_enrollments` originally only let branch staff *insert* a request — but the product spec explicitly wants a **parent** to request transport enrollment for their own child. Fixed in `0004` with a second, narrower insert policy; re-verified that a parent can create a `requested` row, cannot insert an already-`approved` row directly, and staff can approve it and assign a route.
5. The Owner/Fees/Transport summary endpoints originally considered a nested Supabase filter across three joined tables (`payments → invoices → students.branch_id`). Since the `scores` route had already hit unreliable behavior with a similar nested filter, these endpoints instead fetch each table's rows directly and sum/filter in JS — more verbose, but doesn't depend on that query-planner behavior.

**Two more real gaps found and fixed while building the Permissions and Quiz pages:**
6. `quiz_questions` RLS only ever covered branch staff — a parent had no way to see a quiz's questions at all, and the naive fix (add a parent-read policy on the table) would have exposed `correct_index` straight to the browser, since RLS is row-level, not column-level. Fixed with two `SECURITY DEFINER` functions instead: `get_quiz_questions_for_student` returns a type that structurally excludes `correct_index`, and `submit_quiz_attempt` grades server-side and returns only the score. Verified directly: a linked parent gets exactly `{id, question_text, options}` with no answer column present at all; an unrelated parent gets zero rows and a rejected submission; grading a genuine attempt (1 correct, 1 wrong out of 2) returned exactly `{"score": 1, "total": 2}`.
7. `permissions` had a read policy but no write policy at all — meaning nobody, not even an Owner, could actually edit the permission matrix through the API. Fixed with `permissions_owner_insert/update/delete`; verified a Head Teacher's write attempt is rejected by RLS while an Owner's succeeds.

**One more gap found and fixed while building the Setup page:**
8. Almost every reference table (`classes`, `subjects`, `academic_years`, `terms`, `fee_items`, `guardians`, `previous_schools`, `transport_routes`, `invoices`) had a READ policy from 0003 but no WRITE policy anywhere — a school had no way to actually set itself up through the app, only directly in the database. Fixed in `0006` with owner/head_teacher-scoped insert/update policies across all of them. Verified end to end as real SQL: a class teacher's attempt to create a class is rejected by RLS; a head teacher's full onboarding sequence (class → subject → academic year → term → fee item → student → guardian) succeeds in one continuous script.
9. Verified the `class_subjects` weighting `CHECK` constraint (`class_score_weight + exam_weight = 100`) actually rejects a bad split (40/50) and accepts a valid one (40/60) — this is what stops a school from configuring an inconsistent grading formula, not just a client-side form validation that a direct API call could bypass.

**One more real bug — found by an actual user running the actual parent-login flow, not by anything in local testing:**
10. `src/app/auth/callback/route.ts` was a *server* Route Handler that read `?code=` from the URL to exchange it for a session (the standard pattern for Supabase's PKCE flow). But `supabase.auth.admin.generateLink()` — which is what `/api/auth/parent-login` calls, since there's no browser-side PKCE verifier available to an admin-issued link — returns an **implicit-flow** link instead. Visiting it lands back on this app with the session as a URL **fragment** (`/auth/callback#access_token=...`), and fragments are never sent to a server in an HTTP request; the server route could never see them. It always found no `code`, fell through to redirecting to `/parent` with no session established, and `/parent` correctly bounced back to `/login` since there genuinely was no logged-in user — a silent loop with no error message anywhere. Fixed by replacing the server route with a client-side page (`page.tsx`) that reads `window.location.hash` directly and calls `supabase.auth.setSession()` in the browser, with the old `?code=` handling kept as a fallback. This one wasn't caught by any of the local Postgres/build testing in this project, precisely because it's a browser-runtime behavior (fragment handling) that a server-side test can't exercise — it only surfaced once a real person clicked a real magic link in a real browser.
11. `quizzes` and `quiz_questions` were given a SELECT policy in 0001 but **no INSERT policy at all** — meaning no teacher, head teacher, or owner could ever actually create a quiz through the app; the "Weekend Quiz — auto-generate with Groq" feature could only ever fail with "new row violates row-level security policy for table 'quizzes'". Found by a real class teacher account hitting this exact wall in the live app. Fixed in `0007` with insert policies scoped to owner/head_teacher/class_teacher of the class's branch, and verified as real SQL: a class teacher can create both the quiz and its questions, and a parent is correctly blocked from creating one.

---

## 5. Worked example: seeding your first school

```sql
insert into tenants (name, country_default) values ('Golden Crest Academy', 'GH')
returning id; -- copy this id

insert into branches (tenant_id, name, country, address)
values ('<tenant id>', 'Accra Campus', 'GH', 'Spintex Road, Accra')
returning id; -- copy this id

-- Create the head teacher's login in Supabase Auth first (Dashboard →
-- Authentication → Add user, or supabase.auth.admin.createUser), then:
update profiles set tenant_id = '<tenant id>', branch_id = '<branch id>',
  role = 'head_teacher', full_name = 'Mrs. Adjoa Kufuor'
where id = '<the auth user id you just created>';
```

Repeat the `profiles` update for each class teacher, and for parents set `parent_access_code` to whatever code you print and send home (e.g. `GCA-2049`) instead of `role`/`branch_id`.

---

## 6. Project layout

```
src/
  lib/
    supabase/server.ts   — server-side client (respects RLS via the caller's session)
    supabase/client.ts   — browser client, used by the pages below
    supabase/admin.ts    — service-role client (bypasses RLS — webhook + parent-login only)
    groq.ts               — weekend-quiz question generation
  components/ui.tsx        — shared Card/Button/Stamp/PageHeader used by all pages
  middleware.ts            — refreshes the Supabase session cookie on every request
  app/
    page.tsx               — redirects to /login
    login/page.tsx         — staff email/password + parent access-code login
    teacher/page.tsx        — real class register + score submission (POST /api/scores)
    head/page.tsx           — real approval queue (approve/reject via /api/scores/[id]/*)
    parent/page.tsx         — real child overview, approved-only scores, PDF download
    owner/page.tsx          — branch selector + aggregated dashboard (students/fees/pending)
    fees/page.tsx           — per-class billed/paid/balance ledger for staff
    transport/page.tsx      — routes, pending/approved enrollment requests, last bus position
    permissions/page.tsx    — editable permission matrix (writes enforced Owner-only by RLS)
    quiz/page.tsx           — parent takes a weekend quiz on behalf of their child, graded server-side
    setup/page.tsx          — onboard a school: academic year/term/subject/class/fee item, teacher assignment, subject weightings, a student + guardian + parent invite + first invoice, and real CSV bulk import
    auth/callback/route.ts  — redeems the parent's magic link into a real session
    api/
      students/             — list/create students
      students/[id]/        — full profile (bio-data, guardians, scores, invoices)
      students/[id]/generate-invoice/ — sums a class's fee_items into one student's invoice for a term
      students/[id]/invite-parent/    — provisions a real Supabase auth user for a guardian, issues their access code
      scores/                — GET list (by class/branch/term/status) + POST submit (always 'pending')
      scores/[id]/approve/   — head teacher approves
      scores/[id]/reject/    — head teacher rejects
      classes/, classes/[id]/ (PATCH class_teacher_id), subjects/, academic-years/, terms/, fee-items/, guardians/, class-subjects/  — GET list + POST create (staff-only, RLS-enforced)
      staff/                  — list staff profiles for a branch (e.g. to populate a "choose a teacher" dropdown)
      branches/               — list branches accessible to the caller
      owner/summary/          — aggregated student count + fees + pending count for a branch
      fees/class-summary/     — per-student billed/paid/balance
      transport/routes/, transport/enrollments/, transport/enrollments/[id]/approve/, transport/positions/
      permissions/            — GET the matrix, POST upsert a cell (Owner-only, enforced by RLS)
      quiz/                   — GET quiz metadata for a class (safe — no answers)
      quiz/[id]/questions/    — GET questions via the answer-stripping RPC
      quiz/[id]/submit/       — POST an attempt, graded server-side via RPC
      quiz/generate/          — Groq-generated weekend quiz
      auth/parent-login/     — access code → magic link
      payments/webhook/      — verified Paystack webhook
      report-card/[studentId]/[termId]/ — generates the branded PDF report card
supabase/migrations/
  0001_init.sql                       — core schema + RLS on the primary tables
  0002_profiles_rls.sql                — fixes: profiles/owner_branch_access had no RLS
  0003_remaining_rls.sql               — fixes: 13 more tables had no RLS (see §4)
  0004_transport_parent_request.sql    — fixes: parents couldn't request their own transport enrollment
  0005_permissions_and_quiz_taking.sql — fixes: permissions had no write policy; quiz-taking couldn't work for parents without leaking answers
  0006_setup_write_policies.sql        — fixes: no reference table had a write policy, so a school couldn't set itself up through the app
  0007_quiz_write_policies.sql          — fixes: quizzes/quiz_questions had no write policy, so no quiz could ever be created
  0000_local_auth_stub_TEST_ONLY.sql  — testing-only stand-in for Supabase's auth schema
```

## 7. What's actually wired up now, and what still isn't

**Wired and buildable today:** all ten pages (`/login`, `/teacher`, `/head`, `/parent`, `/owner`, `/fees`, `/transport`, `/permissions`, `/quiz`, `/setup`) fetch real data through the API — no mock arrays remain anywhere in `src/app`. A school can now actually onboard itself end to end: an Owner or Head Teacher creates an academic year, term, subject, and class; assigns a class teacher and sets that subject's continuous-assessment/exam weighting (rejected by the database itself if the split doesn't add to 100); sets a fee item; creates a student one at a time or bulk-imports a real CSV; adds a guardian; generates that guardian a real login (a real Supabase auth user + access code, provisioned server-side); and generates the term's invoice from the fee items. From there, a teacher submits a score (lands pending); a head teacher approves it from a real queue; a parent sees only the approved result, downloads a real PDF, requests transport, and takes a weekend quiz that's graded entirely server-side; an owner sees a real branch-scoped dashboard and can edit the permission matrix, which the database itself restricts to the Owner role.

**Still not done:**
- The four standalone mock-data prototypes (`EduLedgerAdmin.jsx`, `EduLedgerParent.jsx`, `EduLedgerTeacher.jsx`, `EduLedgerApp.jsx`) are separate artifacts and were not modified — the pages above are a new, real implementation alongside them, not a rewrite of those files.
- The fuller multi-branch launcher UI from `EduLedgerMultiBranch.jsx` hasn't been rebuilt here — the Owner page lists branches as buttons, not that dedicated view.
- Nothing here has touched a real Supabase project — see §4 for exactly what "tested" means in this codebase versus what still needs a live account to confirm. The `invite-parent` flow in particular (creating real `auth.users` rows) is the single piece here I'd most want to see run against a real project before trusting it, since `createUser`/email-confirmation behavior can only be fully verified against Supabase's actual auth service.
- The CSV bulk-import in `/setup` sends one `POST /api/students` request per row sequentially — fine for the handful of rows a demo needs, but a school importing several hundred students at once would want a batched/background version rather than one request per row in a loop.





