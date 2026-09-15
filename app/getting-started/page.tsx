import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Getting Started | NovelTribe",
  description: "Set up your NovelTribe library, import Goodreads books, and start a reading rhythm in a few simple steps.",
  alternates: { canonical: "/getting-started" },
};

const steps = [
  {
    number: "01",
    title: "Open your tracker",
    body: "Start on the Tracker and add a book manually, search by title, author, or ISBN, or use a recommendation to build your shelf.",
  },
  {
    number: "02",
    title: "Import Goodreads",
    body: "From Profile, choose Import Goodreads CSV and select your Goodreads library export. NovelTribe matches existing books instead of creating duplicates.",
  },
  {
    number: "03",
    title: "Check your categories",
    body: "Goodreads exports often do not include genre columns. NovelTribe uses ISBN metadata to classify books, and every imported book can be edited afterward.",
  },
  {
    number: "04",
    title: "Make it yours",
    body: "Set statuses, ratings, reviews, formats, shelves, moods, quotes, and page counts. Optional habit features stay off until you enable them in Profile.",
  },
];

export default function GettingStartedPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-6 lg:px-8">
        <header className="mb-12 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <a href="/" className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-200">NovelTribe</a>
          </div>
          <nav className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-zinc-300 md:w-auto md:flex-nowrap md:gap-5">
            <a href="/" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="/reading" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Reading</a>
            <a href="/features" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Features</a>
            <a href="/getting-started" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Getting started</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <section className="grid gap-10 border-b border-white/10 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">A quiet first step</div>
            <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl">Bring your reading life home.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">Start with the books already on your shelf, then shape NovelTribe around the way you actually read.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/#tracker" className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/15">Open my tracker</a>
              <a href="/profile" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10">Import from Goodreads</a>
            </div>
          </div>
          <div className="rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-[#111827] to-cyan-500/10 p-6">
            <div className="text-4xl">📚</div>
            <p className="mt-6 text-xl font-semibold leading-8 text-white">Your library can be detailed without feeling like work.</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">Use only the fields and habits that make reading feel more inviting. Everything optional stays private and off until you choose it.</p>
          </div>
        </section>

        <section className="pt-16">
          <div className="mb-8">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">The simple route</div>
            <h2 className="mt-3 text-3xl font-bold text-white">Four steps to a lived-in library.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {steps.map((step) => (
              <article key={step.number} className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <div className="text-sm font-semibold tracking-[0.2em] text-cyan-300">{step.number}</div>
                <h3 className="mt-5 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 leading-7 text-zinc-300">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-8 border-t border-white/10 pt-16 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">Goodreads import notes</div>
            <h2 className="mt-3 text-3xl font-bold text-white">A clean import, with room to adjust.</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
              <li>Use the CSV export from Goodreads, not a spreadsheet you have manually reformatted.</li>
              <li>ISBNs are used to improve covers and category classification, including Kindle editions when metadata is available.</li>
              <li>Re-importing is safe: matching books are updated instead of duplicated.</li>
              <li>Open Edit on the Tracker to change title, author, ISBN, genres, status, rating, review, finish date, format, or shelves.</li>
            </ul>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#111827] p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">After setup</div>
            <h2 className="mt-3 text-2xl font-bold text-white">Keep the next read close.</h2>
            <p className="mt-3 leading-7 text-zinc-300">Set a book to Currently Reading, log a short session, or open Recommendations when you want something new. Your reading rhythm can stay small and private.</p>
            <a href="/recommendations" className="mt-6 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">Browse recommendations</a>
          </div>
        </section>
      </div>
    </main>
  );
}
