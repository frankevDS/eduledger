import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses Row-Level Security entirely.
 * Only ever use this for tasks the *server itself* is trusted to do outside
 * any single user's session: issuing a parent's magic link after verifying
 * their access code, and recording a payment from a webhook that has no
 * logged-in user attached to it. Never import this into anything that
 * handles a request on a user's behalf without an explicit permission check
 * first — it has no RLS safety net.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
