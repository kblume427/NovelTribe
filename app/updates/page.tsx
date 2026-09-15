import type { Metadata } from "next";
import Image from "next/image";

import { MarkUpdatesVisited } from "@/components/updates-cta";

export const metadata: Metadata = {
  title: "Updates | NovelTribe",
  description: "See the latest NovelTribe product updates, improvements, and fixes.",
  alternates: { canonical: "/updates" },
};

const updates = [
  {
    date: "September 15, 2026",
    label: "Reading atmosphere",
    title: "A warmer reading room, sitewide",
    summary: "The Tracker, reading views, profile, public pages, and sign-in surfaces now share a warmer ink, amber, and wood-toned visual language designed to feel more like settling in with a good book.",
    details: ["Warm structural surfaces across core pages", "Amber/orange primary actions", "Subtle paper texture and bookish typography"],
  },
  {
    date: "September 15, 2026",
    label: "Imports",
    title: "Bring in Goodreads or Libby",
    summary: "Profile and onboarding now make both library sources explicit, with separate import buttons and support for Libby/OverDrive tag spreadsheets.",
    details: ["Goodreads CSV import button", "Libby spreadsheet import button", "ISBN, tags, formats, dates, and duplicate-safe syncing"],
  },
  {
    date: "September 15, 2026",
    label: "Library & onboarding",
    title: "A smoother Goodreads library reset",
    summary: "Goodreads imports now classify books from ISBN metadata, preserve multiple categories, support full editing after import, and avoid duplicate shelf entries on re-import.",
    details: ["Goodreads-first genre handling with normalized categories", "Editable ISBN, genres, finish dates, formats, reviews, and shelves", "Getting Started guide with profile and feature-toggle instructions"],
  },
  {
    date: "September 15, 2026",
    label: "Reading experience",
    title: "Sharper covers and clearer paths into the app",
    summary: "Cover resolution now favors high-resolution ISBN artwork, while the homepage makes it easier to start a library or bring over an existing Goodreads shelf.",
    details: ["High-resolution Open Library ISBN cover fallback", "ISBN-first Amazon book links when identifiers are available", "Benefit-driven Tracker and Goodreads import CTAs"],
  },
  {
    date: "September 15, 2026",
    label: "Reliability",
    title: "More dependable sessions across devices",
    summary: "Authentication callbacks now stay on the host where sign-in began, with host-scoped cookies that behave consistently across desktop browsers, mobile Safari, and installed PWAs.",
    details: ["Cross-platform magic-link callback handling", "Improved Safari PWA session persistence", "Public profile navigation no longer relies on a different cookie domain"],
  },
];

export default function UpdatesPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <MarkUpdatesVisited />
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-6 lg:px-8">
        <header className="mb-12 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <a href="/" className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-200">NovelTribe</a>
          </div>
          <nav className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-zinc-300 md:w-auto md:flex-nowrap md:gap-5">
            <a href="/" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="/features" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Features</a>
            <a href="/getting-started" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Getting started</a>
            <a href="/updates" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Updates</a>
            <a href="/faq" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">FAQ</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <section className="mb-14 border-b border-white/10 pb-12">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Product journal</div>
          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl">What’s getting better.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">A quiet record of the fixes, features, and small quality-of-life improvements shaping NovelTribe. New entries from the last seven days appear first, with this opening set preserved as the beginning of the history.</p>
        </section>

        <section className="space-y-6">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">Last 7 days</div>
          {updates.map((update) => (
            <article key={update.title} className="grid gap-6 rounded-[28px] border border-white/10 bg-white/5 p-6 md:grid-cols-[180px_1fr] md:p-8">
              <div>
                <div className="text-sm font-semibold text-amber-200">{update.date}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">{update.label}</div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{update.title}</h2>
                <p className="mt-3 leading-7 text-zinc-300">{update.summary}</p>
                <ul className="mt-5 grid gap-2 text-sm leading-6 text-zinc-400 sm:grid-cols-3">
                  {update.details.map((detail) => <li key={detail} className="rounded-xl border border-white/10 bg-[#0b1120] px-3 py-2">{detail}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
