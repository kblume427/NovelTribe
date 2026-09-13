"use client";

import { useEffect, useState } from "react";

import { createSupabaseClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth") {
      setStatus("That sign-in link expired or was already used. Request a new one.");
    }
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    trackEvent("sign_in_started", { method: "magic_link" });

    const supabase = createSupabaseClient();
    const isProduction =
      process.env.NODE_ENV === "production" ||
      window.location.hostname === "novel-tribe.com" ||
      window.location.hostname.endsWith(".vercel.app");
    const redirectOrigin = isProduction ? "https://novel-tribe.com" : window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectOrigin}/auth/callback`,
      },
    });

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Check your email for a magic sign-in link.");
      trackEvent("sign_in_completed", { method: "magic_link" });
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-6">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-violet-500/10">
        <div className="mb-6 text-xs uppercase tracking-[0.25em] text-violet-200">NovelTribe</div>
        <h1 className="text-3xl font-bold text-white">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          Save your books, build a reading profile, and keep your recommendations synced.
        </p>
        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-3 text-xs leading-5 text-cyan-100">
          On iPhone or iPad, open the magic link in the same Safari browser where you requested it. If the link opens inside Apple Mail, use the share menu to open it in Safari before signing in.
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-zinc-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
              placeholder="you@example.com"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending link..." : "Send magic link"}
          </button>
        </form>

        {status && <p className="mt-5 text-sm text-zinc-300">{status}</p>}
      </div>
    </main>
  );
}
