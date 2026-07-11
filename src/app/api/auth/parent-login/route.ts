import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Parents don't get a password — the school gives them a short code, and
// this route turns that code into a real Supabase session via a magic
// link. It has to use the admin (service-role) client because, before
// login, there IS no session for RLS to key off yet.
//
// Setup this assumes: when the school adds a parent, they create the
// parent's auth.users row (e.g. via supabase.auth.admin.createUser with a
// generated email like parent+<code>@guardians.eduledger.app) and set
// profiles.parent_access_code to the code printed on the note sent home.
export async function POST(request: NextRequest) {
  const { code } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "A code is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("parent_access_code", code.trim().toUpperCase())
    .single();

  if (profileError || !profile || profile.role !== "parent") {
    // Deliberately vague — don't reveal whether the code format was valid
    // vs. simply not found.
    return NextResponse.json({ error: "That code doesn't match our records" }, { status: 401 });
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(profile.id);
  if (authError || !authUser.user?.email) {
    return NextResponse.json({ error: "This parent account isn't fully set up yet — contact the school" }, { status: 500 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  // The client redirects the browser to this URL; Supabase exchanges it for
  // a real session and the auth cookie is set from there on.
  return NextResponse.json({ loginUrl: link.properties.action_link });
}
