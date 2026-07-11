-- ============================================================================
-- EduLedger — migration 0006
-- Closes the last major gap: 0001-0005 gave every reference table a READ
-- policy but almost none of them a WRITE policy, so a school had no way to
-- set itself up (create classes, subjects, terms, fee items) or add a
-- student's guardian through the app — only directly in the database. This
-- adds owner/head_teacher-scoped write policies across the setup tables.
-- ============================================================================

create policy classes_staff_insert on classes
  for insert with check (
    branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
  );
create policy classes_staff_update2 on classes
  for update using (
    branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
  );
-- (students_staff_write from 0001 already covers UPDATE on `classes`? No —
-- that policy is on `students`, not `classes`. `classes` had no UPDATE
-- policy at all before this, e.g. to assign a class_teacher_id later.)

create policy subjects_staff_insert on subjects
  for insert with check (
    branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
  );

create policy class_subjects_staff_insert on class_subjects
  for insert with check (
    exists (
      select 1 from classes c where c.id = class_subjects.class_id
      and c.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );

create policy academic_years_staff_insert on academic_years
  for insert with check (
    branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
  );

create policy terms_staff_insert on terms
  for insert with check (
    exists (
      select 1 from academic_years ay where ay.id = terms.academic_year_id
      and ay.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );

create policy fee_items_staff_insert on fee_items
  for insert with check (
    exists (
      select 1 from classes c where c.id = fee_items.class_id
      and c.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );
create policy fee_items_staff_update on fee_items
  for update using (
    exists (
      select 1 from classes c where c.id = fee_items.class_id
      and c.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );

create policy invoices_staff_insert on invoices
  for insert with check (
    exists (
      select 1 from students s where s.id = invoices.student_id
      and s.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );

create policy guardians_staff_insert on guardians
  for insert with check (
    exists (
      select 1 from students s where s.id = guardians.student_id
      and s.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );
create policy guardians_staff_update on guardians
  for update using (
    exists (
      select 1 from students s where s.id = guardians.student_id
      and s.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );

create policy previous_schools_staff_insert on previous_schools
  for insert with check (
    exists (
      select 1 from students s where s.id = previous_schools.student_id
      and s.branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
    )
  );

create policy transport_routes_staff_insert on transport_routes
  for insert with check (
    branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
  );
