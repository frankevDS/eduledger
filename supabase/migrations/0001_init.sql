-- ============================================================================
-- EduLedger — Supabase migration
-- Adapted from EduLedger_Schema.sql for Supabase's auth model: staff and
-- parents authenticate via Supabase Auth (auth.users), and a `profiles` row
-- links each auth user to a tenant/branch/role. RLS policies key off
-- auth.uid() directly rather than an app-set session variable.
--
-- Apply with the Supabase CLI:  supabase db push
-- or paste into the Supabase Studio SQL editor.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TENANCY & BRANCHES
-- ============================================================================

create table tenants (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    country_default text not null check (country_default in ('GH','NG')),
    created_at      timestamptz not null default now()
);

create table branches (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references tenants(id) on delete cascade,
    name            text not null,
    country         text not null check (country in ('GH','NG')),
    address         text,
    logo_url        text,
    momo_account    text,
    bank_account    jsonb,
    junior_label    text not null default 'JHS',
    senior_label    text not null default 'SHS',
    created_at      timestamptz not null default now()
);
create index idx_branches_tenant on branches(tenant_id);

-- ============================================================================
-- 2. PROFILES (linked to Supabase auth.users) & ROLES
-- ============================================================================

create type user_role as enum ('owner', 'head_teacher', 'class_teacher', 'parent');

create table profiles (
    id                  uuid primary key references auth.users(id) on delete cascade,
    tenant_id           uuid references tenants(id) on delete cascade,
    branch_id           uuid references branches(id) on delete cascade,  -- null for an owner (uses owner_branch_access instead)
    role                user_role not null,
    full_name           text,
    phone               text,
    whatsapp            text,
    parent_access_code  text unique,   -- school-issued code; parent-login route resolves this to an email + magic link
    created_at          timestamptz not null default now()
);
create index idx_profiles_branch on profiles(branch_id);

create table owner_branch_access (
    user_id     uuid not null references profiles(id) on delete cascade,
    branch_id   uuid not null references branches(id) on delete cascade,
    primary key (user_id, branch_id)
);

-- Auto-create a blank profile row whenever a new auth user signs up, so
-- staff onboarding just needs to fill it in rather than insert from scratch.
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, role) values (new.id, 'parent')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Returns every branch_id the calling user (auth.uid()) may see:
-- their own assigned branch, plus any branches an owner has been granted.
create or replace function auth_branch_ids()
returns setof uuid as $$
  select branch_id from profiles where id = auth.uid() and branch_id is not null
  union
  select oba.branch_id from owner_branch_access oba where oba.user_id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- Editable permission matrix (role x action) per branch
create table permissions (
    id          uuid primary key default gen_random_uuid(),
    branch_id   uuid not null references branches(id) on delete cascade,
    role        user_role not null,
    action_key  text not null,
    allowed     boolean not null default false,
    unique (branch_id, role, action_key)
);

-- ============================================================================
-- 3. ACADEMIC STRUCTURE
-- ============================================================================

create type portal_type as enum ('primary', 'secondary');
create type sub_portal_type as enum ('pre_school','lower_primary','upper_primary','junior_secondary','senior_secondary');

create table classes (
    id              uuid primary key default gen_random_uuid(),
    branch_id       uuid not null references branches(id) on delete cascade,
    portal          portal_type not null,
    sub_portal      sub_portal_type not null,
    name            text not null,
    class_teacher_id uuid references profiles(id),
    display_order   int not null default 0,
    unique (branch_id, name)
);
create index idx_classes_branch on classes(branch_id);

create table academic_years (
    id          uuid primary key default gen_random_uuid(),
    branch_id   uuid not null references branches(id) on delete cascade,
    label       text not null,
    start_date  date not null,
    end_date    date not null
);

create table terms (
    id                  uuid primary key default gen_random_uuid(),
    academic_year_id    uuid not null references academic_years(id) on delete cascade,
    name                text not null,
    term_order          smallint not null check (term_order between 1 and 3),
    start_date          date not null,
    end_date            date not null,
    unique (academic_year_id, term_order)
);

create table subjects (
    id          uuid primary key default gen_random_uuid(),
    branch_id   uuid not null references branches(id) on delete cascade,
    name        text not null,
    unique (branch_id, name)
);

create table class_subjects (
    class_id    uuid not null references classes(id) on delete cascade,
    subject_id  uuid not null references subjects(id) on delete cascade,
    class_score_weight smallint not null default 30,
    exam_weight         smallint not null default 70,
    primary key (class_id, subject_id),
    check (class_score_weight + exam_weight = 100)
);

create table grading_scales (
    id          uuid primary key default gen_random_uuid(),
    branch_id   uuid not null references branches(id) on delete cascade,
    name        text not null,
    thresholds  jsonb not null
);

-- ============================================================================
-- 4. STUDENTS, GUARDIANS, PREVIOUS SCHOOLS
-- ============================================================================

create type student_status as enum ('active','inactive','transferred','graduated');

create table students (
    id              uuid primary key default gen_random_uuid(),
    branch_id       uuid not null references branches(id) on delete cascade,
    class_id        uuid not null references classes(id),
    admission_no    text not null,
    first_name      text not null,
    last_name       text not null,
    date_of_birth   date not null,
    gender          text,
    status          student_status not null default 'active',
    admission_date  date not null default current_date,
    photo_url       text,
    created_at      timestamptz not null default now(),
    unique (branch_id, admission_no)
);
create index idx_students_branch on students(branch_id);
create index idx_students_class on students(class_id);

create table guardians (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references students(id) on delete cascade,
    relationship    text not null,
    full_name       text not null,
    phone           text,
    whatsapp        text,
    email           text,
    home_address    text,
    work_address    text,
    is_primary      boolean not null default false,
    linked_profile_id uuid references profiles(id)
);
create index idx_guardians_student on guardians(student_id);

create table previous_schools (
    id          uuid primary key default gen_random_uuid(),
    student_id  uuid not null references students(id) on delete cascade,
    school_name text not null,
    address     text,
    last_class  text,
    note        text
);

-- ============================================================================
-- 5. ACADEMIC RECORDS & APPROVAL WORKFLOW
-- ============================================================================

create type approval_status as enum ('pending','approved','rejected');

create table scores (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references students(id) on delete cascade,
    subject_id      uuid not null references subjects(id),
    term_id         uuid not null references terms(id),
    class_score     numeric(5,2),
    exam_score      numeric(5,2),
    total_score     numeric(5,2) generated always as (coalesce(class_score,0) + coalesce(exam_score,0)) stored,
    status          approval_status not null default 'pending',
    submitted_by    uuid references profiles(id),
    approved_by     uuid references profiles(id),
    submitted_at    timestamptz not null default now(),
    approved_at     timestamptz,
    unique (student_id, subject_id, term_id)
);
create index idx_scores_student on scores(student_id);
create index idx_scores_pending on scores(status) where status = 'pending';

create table pending_edits (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references students(id) on delete cascade,
    field_name      text not null,
    proposed_value  text not null,
    status          approval_status not null default 'pending',
    submitted_by    uuid references profiles(id),
    reviewed_by     uuid references profiles(id),
    submitted_at    timestamptz not null default now(),
    reviewed_at     timestamptz
);

create table report_cards (
    id                  uuid primary key default gen_random_uuid(),
    student_id          uuid not null references students(id) on delete cascade,
    term_id             uuid not null references terms(id),
    attendance_present  int,
    attendance_total    int,
    position_in_class   text,
    teacher_remark      text,
    head_remark         text,
    pdf_url             text,
    generated_at        timestamptz,
    unique (student_id, term_id)
);

-- ============================================================================
-- 6. ATTENDANCE
-- ============================================================================

create type attendance_status as enum ('present','absent','late');

create table attendance (
    id          uuid primary key default gen_random_uuid(),
    student_id  uuid not null references students(id) on delete cascade,
    date        date not null,
    status      attendance_status not null,
    marked_by   uuid references profiles(id),
    unique (student_id, date)
);

-- ============================================================================
-- 7. FEES & PAYMENTS
-- ============================================================================

create table fee_items (
    id          uuid primary key default gen_random_uuid(),
    class_id    uuid not null references classes(id) on delete cascade,
    term_id     uuid not null references terms(id),
    name        text not null,
    amount      numeric(10,2) not null
);

create table invoices (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references students(id) on delete cascade,
    term_id         uuid not null references terms(id),
    total_billed    numeric(10,2) not null,
    created_at      timestamptz not null default now(),
    unique (student_id, term_id)
);

create type payment_method as enum ('momo','card','bank_transfer','cash');

create table payments (
    id                  uuid primary key default gen_random_uuid(),
    invoice_id          uuid not null references invoices(id) on delete cascade,
    amount              numeric(10,2) not null,
    method              payment_method not null,
    provider_reference  text,
    receipt_no          text unique,
    paid_at             timestamptz not null default now(),
    paid_by             uuid references profiles(id)
);
create index idx_payments_invoice on payments(invoice_id);

-- ============================================================================
-- 8. TRANSPORT
-- ============================================================================

create table transport_routes (
    id              uuid primary key default gen_random_uuid(),
    branch_id       uuid not null references branches(id) on delete cascade,
    name            text not null,
    driver_name     text,
    driver_phone    text
);

create type transport_status as enum ('requested','approved','withdrawn');

create table transport_enrollments (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references students(id) on delete cascade,
    route_id        uuid references transport_routes(id),
    status          transport_status not null default 'requested',
    requested_at    timestamptz not null default now()
);

create table bus_positions (
    id          bigserial primary key,
    route_id    uuid not null references transport_routes(id) on delete cascade,
    lat         double precision not null,
    lng         double precision not null,
    recorded_at timestamptz not null default now()
);
create index idx_bus_positions_route_time on bus_positions(route_id, recorded_at desc);

-- ============================================================================
-- 9. WEEKEND QUIZZES (Groq-generated)
-- ============================================================================

create table quizzes (
    id              uuid primary key default gen_random_uuid(),
    class_id        uuid not null references classes(id) on delete cascade,
    subject_id      uuid references subjects(id),
    title           text not null,
    assigned_by     uuid references profiles(id),
    assigned_at     timestamptz not null default now(),
    due_at          timestamptz
);

create table quiz_questions (
    id              uuid primary key default gen_random_uuid(),
    quiz_id         uuid not null references quizzes(id) on delete cascade,
    question_text   text not null,
    options         jsonb not null,
    correct_index   smallint not null
);

create table quiz_attempts (
    id              uuid primary key default gen_random_uuid(),
    quiz_id         uuid not null references quizzes(id) on delete cascade,
    student_id      uuid not null references students(id) on delete cascade,
    score           smallint not null,
    total_questions smallint not null,
    submitted_at    timestamptz not null default now(),
    unique (quiz_id, student_id)
);

-- ============================================================================
-- 10. CALENDAR
-- ============================================================================

create table public_holidays (
    id      uuid primary key default gen_random_uuid(),
    country text not null check (country in ('GH','NG')),
    date    date not null,
    name    text not null
);

create table calendar_events (
    id                  uuid primary key default gen_random_uuid(),
    branch_id           uuid not null references branches(id) on delete cascade,
    academic_year_id    uuid references academic_years(id),
    date                date not null,
    title               text not null,
    event_type          text
);

-- ============================================================================
-- 11. MARKET INSIGHTS (public data only)
-- ============================================================================

create table market_insights (
    id                  uuid primary key default gen_random_uuid(),
    branch_id           uuid not null references branches(id) on delete cascade,
    nearby_school_name  text not null,
    distance_km         numeric(5,2),
    published_fee_range text,
    published_metric    text,
    source_url          text,
    fetched_at          timestamptz not null default now()
);

-- ============================================================================
-- 12. AUDIT LOG
-- ============================================================================

create table audit_log (
    id          bigserial primary key,
    tenant_id   uuid not null,
    branch_id   uuid,
    user_id     uuid references profiles(id),
    action      text not null,
    entity_type text not null,
    entity_id   uuid,
    before      jsonb,
    after       jsonb,
    created_at  timestamptz not null default now()
);
create index idx_audit_branch_time on audit_log(branch_id, created_at desc);

-- ============================================================================
-- 13. ROW-LEVEL SECURITY
-- ============================================================================

alter table students enable row level security;
alter table guardians enable row level security;
alter table previous_schools enable row level security;
alter table classes enable row level security;
alter table scores enable row level security;
alter table pending_edits enable row level security;
alter table report_cards enable row level security;
alter table attendance enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table transport_enrollments enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table calendar_events enable row level security;
alter table market_insights enable row level security;

-- Two tables' policies would otherwise reference each other directly —
-- students_parent_read needs guardians, guardians_read needs students —
-- which Postgres correctly refuses to evaluate (infinite recursion).
-- These SECURITY DEFINER helpers break the cycle: because they're owned by
-- the migration role (table owner), the queries *inside* them bypass RLS
-- entirely, so calling them from a policy never re-triggers that policy.
-- This was caught by testing the actual workflow end-to-end, not just
-- applying the migration — see EduLedger_Backend_Notes.md §3 for the
-- Postgres-level (non-Supabase) version of this same lesson.

create or replace function student_is_visible(sid uuid)
returns boolean as $$
  select exists (
    select 1 from students s where s.id = sid and s.branch_id in (select auth_branch_ids())
  ) or exists (
    select 1 from guardians g where g.student_id = sid and g.linked_profile_id = auth.uid()
  );
$$ language sql stable security definer;

create or replace function score_is_visible(sid uuid, s_status approval_status)
returns boolean as $$
  select exists (
    select 1 from students s where s.id = sid and s.branch_id in (select auth_branch_ids())
  ) or (
    s_status = 'approved' and exists (
      select 1 from guardians g where g.student_id = sid and g.linked_profile_id = auth.uid()
    )
  );
$$ language sql stable security definer;

create policy students_read on students
  for select using ( student_is_visible(id) );

create policy students_staff_write on students
  for all using (
    branch_id in (select auth_branch_ids())
    and auth_role() in ('owner','head_teacher')
  );

create policy guardians_read on guardians
  for select using ( student_is_visible(student_id) );

create policy previous_schools_read on previous_schools
  for select using ( student_is_visible(student_id) );

create policy classes_branch_read on classes
  for select using (branch_id in (select auth_branch_ids()));

-- Scores: staff in the branch see every status; a linked parent sees only
-- 'approved' rows — score_is_visible() encodes both in one place so no
-- query path can accidentally show a parent a pending or rejected score.
create policy scores_read on scores
  for select using ( score_is_visible(student_id, status) );

create policy scores_staff_insert on scores
  for insert with check (
    auth_role() in ('class_teacher','head_teacher','owner')
    and exists (select 1 from students s where s.id = scores.student_id and s.branch_id in (select auth_branch_ids()))
  );

create policy scores_approval_update on scores
  for update using (
    auth_role() in ('head_teacher','owner')
    and exists (select 1 from students s where s.id = scores.student_id and s.branch_id in (select auth_branch_ids()))
  );

create policy pending_edits_branch on pending_edits
  for all using (
    exists (select 1 from students s where s.id = pending_edits.student_id and s.branch_id in (select auth_branch_ids()))
  );

create policy report_cards_read on report_cards
  for select using ( student_is_visible(student_id) );

create policy attendance_branch on attendance
  for all using (
    exists (select 1 from students s where s.id = attendance.student_id and s.branch_id in (select auth_branch_ids()))
  );

create policy invoices_read on invoices
  for select using ( student_is_visible(student_id) );

create policy payments_read on payments
  for select using (
    exists (select 1 from invoices i where i.id = payments.invoice_id and student_is_visible(i.student_id))
  );
-- Note: payments are normally written by the service-role client from the
-- payment webhook (src/app/api/payments/webhook), which bypasses RLS
-- entirely and is not part of this policy set.

create policy transport_read on transport_enrollments
  for select using ( student_is_visible(student_id) );

create policy transport_staff_write on transport_enrollments
  for insert with check (
    exists (select 1 from students s where s.id = transport_enrollments.student_id and s.branch_id in (select auth_branch_ids()))
  );
create policy transport_staff_update on transport_enrollments
  for update using (
    exists (select 1 from students s where s.id = transport_enrollments.student_id and s.branch_id in (select auth_branch_ids()))
  );

create policy quizzes_branch_read on quizzes
  for select using (
    exists (select 1 from classes c where c.id = quizzes.class_id and c.branch_id in (select auth_branch_ids()))
  );
create policy quiz_questions_branch_read on quiz_questions
  for select using (
    exists (
      select 1 from quizzes q join classes c on c.id = q.class_id
      where q.id = quiz_questions.quiz_id and c.branch_id in (select auth_branch_ids())
    )
  );
create policy quiz_attempts_branch on quiz_attempts
  for all using (
    exists (select 1 from students s where s.id = quiz_attempts.student_id and s.branch_id in (select auth_branch_ids()))
  );

create policy calendar_events_branch_read on calendar_events
  for select using (branch_id in (select auth_branch_ids()));

create policy market_insights_branch_read on market_insights
  for select using (branch_id in (select auth_branch_ids()));
