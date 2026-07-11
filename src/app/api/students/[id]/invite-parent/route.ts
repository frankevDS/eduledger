import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `GCA-${digits}`;
}

// This is the one place in the whole app that creates a brand-new login —
// everywhere else assumes the auth.users row already exists. It has to use
// the service-role client for that (regular users can't create other
// users), which is exactly the kind of operation 0002's comments flagged
// as needing to "go through an owner/head teacher via the service-role
// client" rather than a guardian editing their own role/branch directly.
//
// The authorization check below uses the REGULAR (RLS-respecting) client
// first — only after confirming the caller is genuinely owner/head_teacher
// of this student's branch does the route switch to the admin client.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { guardian_id } = await request.json();
  if (!guardian_id) return NextResponse.json({ error: "guardian_id is required" }, { status: 400 });

  // RLS-scoped check: this SELECT only succeeds if the caller can actually
  // see this student (i.e. is staff in the right branch) AND the guardian
  // row genuinely belongs to that student — using the ordinary client, not
  // the admin one, so there's no way to skip this check by mistake.
  const { data: guardian, error: guardianError } = await supabase
    .from("guardians")
    .select("id, full_name, email, student_id, students!inner(id)")
    .eq("id", guardian_id)
    .eq("student_id", studentId)
    .single();

  if (guardianError || !guardian) {
    return NextResponse.json({ error: "Guardian not found, or you don't have access to this student" }, { status: 404 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || !["owner", "head_teacher"].includes(profile.role)) {
    return NextResponse.json({ error: "Only the Owner or Head Teacher can invite a parent" }, { status: 403 });
  }

  const admin = createAdminClient();
  const code = generateCode();
  // Guardians often won't have a real email on file — fall back to a
  // synthetic one scoped to this deployment, matching the convention
  // documented in /api/auth/parent-login.
  const email = guardian.email || `guardian+${code.toLowerCase()}@guardians.eduledger.app`;

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !createdUser.user) {
    return NextResponse.json({ error: createError?.message ?? "Could not create the parent account" }, { status: 500 });
  }

  // The handle_new_auth_user trigger (0001) already inserted a blank
  // profile row with role='parent' for this new user — this just fills it
  // in with the real name and the access code the school will print/send.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: guardian.full_name, parent_access_code: code })
    .eq("id", createdUser.user.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { error: linkError } = await admin
    .from("guardians")
    .update({ linked_profile_id: createdUser.user.id })
    .eq("id", guardian_id);
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  return NextResponse.json({ accessCode: code, email }, { status: 201 });
}
