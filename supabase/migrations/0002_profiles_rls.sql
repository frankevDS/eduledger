-- ============================================================================
-- EduLedger — migration 0002
-- Fixes a real gap in 0001: `profiles` and `owner_branch_access` were never
-- RLS-enabled, so any authenticated user could read every staff/parent
-- profile in the database (including other branches' teachers and every
-- parent's contact info). Found while wiring the frontend pages, which is
-- exactly the kind of thing that's easy to miss when you design a schema
-- top-down and only catches up with you once something actually queries it.
-- ============================================================================

alter table profiles enable row level security;

-- Everyone can read their own profile row (needed just to know your own
-- role/branch_id after logging in).
create policy profiles_self_read on profiles
  for select using (id = auth.uid());

-- Staff can see other profiles within branches they have access to (e.g. a
-- Head Teacher looking up a class teacher's name/phone) — but this does NOT
-- extend to parents, since a parent profile has branch_id = null and isn't
-- covered by auth_branch_ids() from the other side either.
create policy profiles_branch_read on profiles
  for select using (
    branch_id is not null and branch_id in (select auth_branch_ids())
  );

-- Small security-definer helper so the policy below doesn't query `profiles`
-- directly from within its own WITH CHECK clause (that re-triggers this
-- table's RLS and recurses, exactly like the students/guardians case in
-- 0001 — same lesson, different table).
create or replace function auth_own_branch_id()
returns uuid as $$
  select branch_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- A user may update their own contact details, but not their own role or
-- branch (that has to go through an owner/head teacher via the service-role
-- client — this policy intentionally does not allow self-promotion).
create policy profiles_self_update_contact on profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = auth_role()
    and branch_id is not distinct from auth_own_branch_id()
  );

alter table owner_branch_access enable row level security;

create policy owner_branch_access_self on owner_branch_access
  for select using (user_id = auth.uid());
