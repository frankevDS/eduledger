-- ============================================================================
-- EduLedger — migration 0004
-- 0001's transport_enrollments policies only let branch STAFF insert a row
-- (transport_staff_write) — but the original product spec is explicit that
-- a PARENT requests transport enrollment themselves, with the school then
-- approving it. Parents have no branch_id, so transport_staff_write's
-- auth_branch_ids() check could never pass for them. This adds a second,
-- narrower insert policy just for that case — Postgres OR-combines
-- multiple permissive policies for the same command, so this doesn't
-- replace the staff policy, it adds to it.
-- ============================================================================

-- A parent may create a request for their own linked child, but only in the
-- 'requested' state — they cannot insert a row that's already 'approved'.
create policy transport_parent_request on transport_enrollments
  for insert with check (
    status = 'requested'
    and exists (
      select 1 from guardians g
      where g.student_id = transport_enrollments.student_id
      and g.linked_profile_id = auth.uid()
    )
  );
