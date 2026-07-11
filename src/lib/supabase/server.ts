import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Uses the caller's session (from cookies), so every query goes through
 * Postgres Row-Level Security exactly as if the user ran it themselves —
 * this is what makes branch isolation hold even if a route handler forgets
 * to add a WHERE clause.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no response to attach
            // cookies to — safe to ignore because middleware refreshes
            // the session on the next request anyway.
          }
        },
      },
    }
  );
}
