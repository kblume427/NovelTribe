"use client";

import Image from "next/image";
import { useState } from "react";

import { trackEvent } from "@/lib/analytics";

export default function FeedbackPage() {
  const [type, setType] = useState("Bug report");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: trimmedMessage, contact: contact.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Feedback could not be sent. Please try again later.");
        return;
      }
      trackEvent("feedback_submitted", { type, has_contact: contact.trim() ? 1 : 0 });
      setSubmitted(true);
      setMessage("");
      setContact("");
    } catch {
      setError("Feedback could not be sent. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="reading-canvas min-h-screen text-white">
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-6 lg:px-8">
        <header className="mb-12 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <a href="/" className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-200">NovelTribe</a>
          </div>
          <nav className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-zinc-300 md:w-auto md:flex-nowrap md:gap-5">
            <a href="/" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="/faq" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">FAQ</a>
            <a href="/getting-started" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Getting started</a>
            <a href="/feedback" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Feedback</a>
          </nav>
        </header>

        <section className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Help shape the shelf</div>
            <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-6xl">Tell us what would make reading better.</h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">Report a bug, suggest an improvement, or tell us where the reading experience feels rough.</p>
            <p className="mt-5 text-sm leading-6 text-zinc-500">Please avoid sending passwords, private reviews, or sensitive personal information. Your message will be routed securely to the NovelTribe team.</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-500/5 md:p-8">
            <label className="block">
              <span className="mb-2 block text-sm text-zinc-300">What kind of feedback?</span>
              <select value={type} onChange={(event) => setType(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60">
                <option>Bug report</option>
                <option>Feature idea</option>
                <option>Import issue</option>
                <option>General feedback</option>
              </select>
            </label>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-zinc-300">What happened?</span>
              <textarea required value={message} onChange={(event) => setMessage(event.target.value)} rows={7} maxLength={4000} placeholder="Tell us what you expected and what you saw..." className="w-full resize-y rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60" />
            </label>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-zinc-300">Reply-to email <span className="text-zinc-500">(optional)</span></span>
              <input type="email" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="you@example.com" className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60" />
            </label>
            <button type="submit" disabled={submitting} className="mt-6 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Sending..." : "Send feedback"}</button>
            {submitted && <p className="mt-4 text-sm text-cyan-200">Thanks. Your feedback was sent to the NovelTribe team.</p>}
            {error && <p className="mt-4 text-sm text-red-200">{error}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
