"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader, C } from "@/components/ui";

// THE BUG THIS FILE FIXES:
//
// The parent-login flow issues a Supabase magic link via the Admin API
// (supabase.auth.admin.generateLink). Links generated that way — since
// there's no browser-side PKCE code_verifier for the admin API to pair
// with — come back as an *implicit-flow* link. When visited, Supabase
// verifies the token and redirects here with the session as a URL
// **fragment**: `/auth/callback#access_token=...&refresh_token=...`.
//
// A URL fragment is never sent to the server in an HTTP request — browsers
// strip it before the request leaves the client. So the previous version of
// this file (a route.ts Server Route reading `?code=` from searchParams)
// could never see those tokens at all: it always found nothing, fell
// through to redirecting to `/parent` with no session ever established,
// and `/parent` then correctly bounced back to `/login` because there was
// genuinely no logged-in user. That's exactly the loop that was reported.
//
// The fix has to run in the browser, where `window.location.hash` is
// actually visible, and hand the tokens to Supabase via `setSession`
// directly — no server round-trip involved for this part at all.
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<PageHeader title="Golden Crest Academy" subtitle="Signing you in…" showLogout={false} />}>
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const next = searchParams.get("next") || "/parent";

      // Case 1: implicit-flow tokens in the hash fragment (what the
      // parent-login magic link actually produces — see note above).
      const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        router.replace(next);
        return;
      }

      // Case 2: PKCE-style `?code=` — kept as a fallback in case a
      // Supabase project is configured to issue that style instead.
      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        router.replace(next);
        return;
      }

      setError("No login token was found in this link. It may have expired — go back and request a new one.");
    })();
  }, [router, searchParams]);

  return (
    <div>
      <PageHeader title="Golden Crest Academy" subtitle="Signing you in…" showLogout={false} />
      <div style={{ padding: 20, maxWidth: 420, margin: "0 auto" }}>
        {error ? (
          <div style={{ color: C.brick, fontSize: 13 }}>{error}</div>
        ) : (
          <div style={{ color: C.inkSoft, fontSize: 13 }}>Please wait…</div>
        )}
      </div>
    </div>
  );
}
