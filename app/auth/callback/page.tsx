"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const searchParams = new URLSearchParams(window.location.search);
    const nextValue = searchParams.get("next") ?? "/";
    const next = nextValue.startsWith("/") && !nextValue.startsWith("//") ? nextValue : "/";
    let active = true;

    async function finishSignIn() {
      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError("That sign-in link expired or was already used. Request a new one.");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;

      if (session) {
        router.replace(next);
      } else {
        setError("That sign-in link could not be verified. Request a new one.");
      }
    }

    void finishSignIn();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="reading-canvas flex min-h-screen items-center justify-center px-6 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-8 text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-bold">Sign-in link unavailable</h1>
            <p className="mt-3 text-sm text-zinc-300">{error}</p>
            <a href="/login" className="mt-6 inline-flex rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-[#20130d]">Return to sign in</a>
          </>
        ) : (
          <p className="text-sm text-zinc-300">Finishing your sign-in...</p>
        )}
      </div>
    </main>
  );
}