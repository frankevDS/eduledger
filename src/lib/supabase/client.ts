import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. The EduLedger portal prototypes
 * (EduLedgerApp.jsx etc.) are currently static mock-data demos; wiring them
 * to real data means importing this client and swapping the mock arrays for
 * `await supabase.from(...).select(...)` calls.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
