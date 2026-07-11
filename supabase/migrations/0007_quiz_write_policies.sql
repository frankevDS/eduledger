-- ============================================================================
-- EduLedger — migration 0007
-- `quizzes` and `quiz_questions` were given a read policy in 0001 but never
-- a write one — meaning no teacher, head teacher, or owner could ever
-- actually create a quiz through the app, only read one that (impossibly)
-- already existed. Found by a real teacher account hitting exactly this
-- wall via /api/quiz/generate ("new row violates row-level security policy
-- for table 'quizzes'").
-- ============================================================================

create policy quizzes_staff_insert on quizzes
  for insert with check (
    exists (
      select 1 from classes c where c.id = quizzes.class_id
      and c.branch_id in (select auth_branch_ids())
      and auth_role() in ('owner','head_teacher','class_teacher')
    )
  );

create policy quiz_questions_staff_insert on quiz_questions
  for insert with check (
    exists (
      select 1 from quizzes q
      join classes c on c.id = q.class_id
      where q.id = quiz_questions.quiz_id
      and c.branch_id in (select auth_branch_ids())
      and auth_role() in ('owner','head_teacher','class_teacher')
    )
  );
