-- ============================================================================
-- EduLedger — migration 0005
-- Two more real gaps:
--
-- 1. `permissions` (0003) only ever got a SELECT policy — nobody, not even
--    an Owner, could actually edit the permission matrix through the API.
--
-- 2. `quiz_questions` RLS (0001) only lets branch STAFF read it — a parent
--    or student has no way to see a quiz's questions at all, which makes
--    the weekend-quiz feature unusable for its actual audience. The naive
--    fix (add a parent-read policy on quiz_questions) is wrong: that table
--    contains `correct_index`, and RLS is row-level, not column-level — any
--    policy that lets a parent read the row lets them read the answer key
--    too, straight from the browser via the Supabase client. The right fix
--    is two SECURITY DEFINER functions: one that returns questions with
--    correct_index stripped out, and one that grades an attempt server-side
--    without ever handing the answer key to the client that's taking it.
-- ============================================================================

-- ---- 1. Permissions: Owner can edit; everyone in the branch can still read
-- (via the existing 0003 permissions_read policy).

create policy permissions_owner_insert on permissions
  for insert with check (
    branch_id in (select auth_branch_ids()) and auth_role() = 'owner'
  );

create policy permissions_owner_update on permissions
  for update using (
    branch_id in (select auth_branch_ids()) and auth_role() = 'owner'
  );

create policy permissions_owner_delete on permissions
  for delete using (
    branch_id in (select auth_branch_ids()) and auth_role() = 'owner'
  );

-- ---- 2. Quiz metadata (title/due date — no answers) is fine for a parent
-- to read directly, so this one CAN be a normal RLS policy.

create policy quizzes_parent_read on quizzes
  for select using (
    exists (
      select 1 from students s
      join guardians g on g.student_id = s.id
      where s.class_id = quizzes.class_id and g.linked_profile_id = auth.uid()
    )
  );

-- ---- 3. Fetch questions for taking a quiz — answer key stripped, and only
-- returned to branch staff or to a parent whose linked child is actually in
-- the quiz's class.

create or replace function get_quiz_questions_for_student(p_quiz_id uuid, p_student_id uuid)
returns table (id uuid, question_text text, options jsonb)
language sql stable security definer as $$
  select qq.id, qq.question_text, qq.options
  from quiz_questions qq
  join quizzes q on q.id = qq.quiz_id
  where qq.quiz_id = p_quiz_id
  and (
    exists (select 1 from classes c where c.id = q.class_id and c.branch_id in (select auth_branch_ids()))
    or exists (
      select 1 from students s
      join guardians g on g.student_id = s.id
      where s.id = p_student_id and s.class_id = q.class_id and g.linked_profile_id = auth.uid()
    )
  );
$$;

-- ---- 4. Grade an attempt server-side. The client sends
-- {"<question_id>": <selected_option_index>, ...} and gets back a score —
-- it never receives correct_index at any point in this flow.

create or replace function submit_quiz_attempt(p_quiz_id uuid, p_student_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer as $$
declare
  v_authorized boolean;
  v_total int;
  v_correct int;
begin
  select exists (
    select 1 from students s
    join guardians g on g.student_id = s.id
    join quizzes q on q.class_id = s.class_id
    where s.id = p_student_id and q.id = p_quiz_id and g.linked_profile_id = auth.uid()
  ) into v_authorized;

  if not v_authorized then
    raise exception 'not authorized to submit this quiz for this student';
  end if;

  select count(*) into v_total from quiz_questions where quiz_id = p_quiz_id;

  select count(*) into v_correct
  from quiz_questions qq
  where qq.quiz_id = p_quiz_id
  and (p_answers ->> qq.id::text)::int = qq.correct_index;

  insert into quiz_attempts (quiz_id, student_id, score, total_questions)
  values (p_quiz_id, p_student_id, v_correct, v_total)
  on conflict (quiz_id, student_id)
  do update set score = excluded.score, total_questions = excluded.total_questions, submitted_at = now();

  return jsonb_build_object('score', v_correct, 'total', v_total);
end;
$$;
