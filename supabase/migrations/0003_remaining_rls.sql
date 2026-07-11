-- ============================================================================
-- EduLedger — migration 0003
-- Closes a real gap: 0001 enabled RLS on the "obviously sensitive" tables
-- (students, scores, payments...) but left 13 reference/config tables with
-- NO row-level security at all — tenants, branches, subjects, terms,
-- academic_years, grading_scales, fee_items, transport_routes,
-- bus_positions, permissions, class_subjects, audit_log, and public_holidays.
-- Without this, any authenticated user (from ANY school) could read every
-- other school's subject list, term dates, fee amounts, and tenant/branch
-- names — a real cross-tenant data leak, just of configuration rather than
-- student data. Confirmed missing by grep against 0001 before writing this.
-- ============================================================================

alter table tenants enable row level security;
create policy tenants_read on tenants
  for select using (
    id in (select tenant_id from branches where id in (select auth_branch_ids()))
  );

alter table branches enable row level security;
create policy branches_read on branches
  for select using (id in (select auth_branch_ids()));

alter table subjects enable row level security;
create policy subjects_read on subjects
  for select using (branch_id in (select auth_branch_ids()));

alter table class_subjects enable row level security;
create policy class_subjects_read on class_subjects
  for select using (
    exists (select 1 from classes c where c.id = class_subjects.class_id and c.branch_id in (select auth_branch_ids()))
  );

alter table academic_years enable row level security;
create policy academic_years_read on academic_years
  for select using (branch_id in (select auth_branch_ids()));

alter table terms enable row level security;
create policy terms_read on terms
  for select using (
    exists (select 1 from academic_years ay where ay.id = terms.academic_year_id and ay.branch_id in (select auth_branch_ids()))
  );

alter table grading_scales enable row level security;
create policy grading_scales_read on grading_scales
  for select using (branch_id in (select auth_branch_ids()));

alter table fee_items enable row level security;
create policy fee_items_read on fee_items
  for select using (
    exists (select 1 from classes c where c.id = fee_items.class_id and c.branch_id in (select auth_branch_ids()))
  );

alter table transport_routes enable row level security;
create policy transport_routes_read on transport_routes
  for select using (branch_id in (select auth_branch_ids()));

alter table bus_positions enable row level security;
create policy bus_positions_read on bus_positions
  for select using (
    exists (select 1 from transport_routes r where r.id = bus_positions.route_id and r.branch_id in (select auth_branch_ids()))
  );

alter table permissions enable row level security;
create policy permissions_read on permissions
  for select using (branch_id in (select auth_branch_ids()));

-- Audit log is more sensitive than a plain read: restrict it to owners and
-- head teachers of the branch, not every staff member.
alter table audit_log enable row level security;
create policy audit_log_read on audit_log
  for select using (
    branch_id in (select auth_branch_ids()) and auth_role() in ('owner','head_teacher')
  );

-- Public holidays are deliberately NOT tenant data — every school in the
-- same country sees the same national holidays — so this is a genuinely
-- permissive "any authenticated user can read" policy, not an oversight.
alter table public_holidays enable row level security;
create policy public_holidays_read on public_holidays
  for select using (true);
