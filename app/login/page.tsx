"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth") {
      setStatus("That sign-in link expired or was already used. Request a new code.");
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timeout = window.setTimeout(() => setResendCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [resendCooldown]);

  async function sendCode(isResend = false) {
    trackEvent(isResend ? "verification_code_resent" : "sign_in_started", { method: "email_code" });
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setStatus(error.message);
    } else {
      setCodeSent(true);
      setResendCooldown(30);
      setStatus("Check your email for the six-digit verification code.");
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    const supabase = createSupabaseClient();

    if (codeSent) {
      trackEvent("sign_in_started", { method: "email_code" });
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode.trim(),
        type: "email",
      });

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("The code was accepted, but your session could not be created. Please try again.");
        setLoading(false);
        return;
      }

      const syncResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      });

      if (!syncResponse.ok) {
        setStatus("Your code was accepted, but your session could not be synchronized. Please try again.");
      } else {
        trackEvent("sign_in_completed", { method: "email_code" });
        const hasOnboarded = window.localStorage.getItem("ntb_onboarded");
        if (!hasOnboarded) {
          window.localStorage.setItem("ntb_onboarded", "1");
          trackEvent("first_time_onboarding_redirect");
          router.replace("/getting-started");
        } else {
          router.replace("/");
        }
      }
      setLoading(false);
      return;
    }

    await sendCode();
    setLoading(false);
  }

  return (
    <main className="reading-canvas flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-violet-500/10">
        <div className="mb-6 text-xs uppercase tracking-[0.25em] text-violet-200">NovelTribe</div>
        <h1 className="text-3xl font-bold text-white">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          Save your books, build a reading profile, and keep your recommendations synced.
        </p>
        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-3 text-xs leading-5 text-cyan-100">
          We will email you a verification code. Enter it here to finish signing in, including when you are using the NovelTribe app on iPhone or iPad.
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

          {codeSent && (
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-300">Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                maxLength={8}
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-center text-xl tracking-[0.35em] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                placeholder="123456"
                required
              />
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-3 font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (codeSent ? "Verifying..." : "Sending code...") : (codeSent ? "Verify code" : "Email me a code")}
          </button>
        </form>

        {codeSent && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setCodeSent(false); setVerificationCode(""); setResendCooldown(0); setStatus(null); }}
              className="text-xs text-cyan-200 underline"
            >
              Use a different email
            </button>
            <button
              type="button"
              disabled={resendCooldown > 0}
              onClick={() => void sendCode(true)}
              className="text-xs text-cyan-200 underline disabled:cursor-not-allowed disabled:text-zinc-500 disabled:no-underline"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        )}

        {status && <p className="mt-5 text-sm text-zinc-300">{status}</p>}
      </div>
    </main>
  );
}
