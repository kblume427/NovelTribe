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
    title: "Import your library",
    body: "From Profile, choose Import Goodreads or Libby and select a Goodreads CSV or Libby/OverDrive tag spreadsheet. NovelTribe matches existing books instead of creating duplicates.",
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
    <main className="reading-canvas min-h-screen text-white">
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
            <a href="/updates" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Updates</a>
            <a href="/faq" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">FAQ</a>
            <a href="/feedback" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Feedback</a>
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
              <a href="/profile" className="rounded-full border border-violet-400/30 bg-violet-500/15 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25">Import Goodreads</a>
              <a href="/profile" className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">Import Libby</a>
            </div>
          </div>
          <div className="rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-[#1c1614] to-[#20191d] p-6">
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
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">Profile setup</div>
            <h2 className="mt-3 text-3xl font-bold text-white">Make your home base yours.</h2>
            <ol className="mt-5 space-y-4 text-sm leading-6 text-zinc-300">
              <li><span className="font-semibold text-white">1.</span> Open <a href="/profile" className="text-cyan-200 underline">Profile</a> and add your display name, username, avatar, and favorite categories.</li>
              <li><span className="font-semibold text-white">2.</span> Set an annual reading goal if you want a gentle progress target.</li>
              <li><span className="font-semibold text-white">3.</span> Keep your profile private by default. Public profile, library, ratings, reviews, and activity controls are separate choices.</li>
              <li><span className="font-semibold text-white">4.</span> Save your profile changes before leaving the page.</li>
            </ol>
          </div>
          <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/5 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Feature controls</div>
            <h2 className="mt-3 text-3xl font-bold text-white">Turn on only what helps.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">In Profile, scroll to Optional features. Every toggle starts off, so your tracker stays simple until you choose more.</p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
              <li><span className="font-semibold text-white">Reading habits:</span> enable sessions, reminders, streaks, goals, and finish-date estimates.</li>
              <li><span className="font-semibold text-white">Book details:</span> enable moods, quotes, custom shelves, and format or audiobook tracking.</li>
              <li><span className="font-semibold text-white">Discovery:</span> enable personalized recommendations and strict peer genre matching.</li>
              <li><span className="font-semibold text-white">Dashboard:</span> show or hide progress widgets, milestones, and session timelines.</li>
            </ul>
            <p className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2.5 text-sm font-bold leading-6 text-amber-100">
              Important: click <span className="uppercase tracking-wide">Save profile</span> at the bottom of Profile to apply your feature changes.
            </p>
            <a href="/profile" className="mt-6 inline-flex rounded-full bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30">Open Profile settings</a>
          </div>
        </section>

        <section className="mt-16 grid gap-8 border-t border-white/10 pt-16 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">Library import notes</div>
            <h2 className="mt-3 text-3xl font-bold text-white">Bring your library in, with room to adjust.</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
              <li>Use the CSV export from Goodreads, or export a Libby tag as a spreadsheet from Tags → Actions → Export Tag → Spreadsheet → Titles.</li>
              <li>ISBNs are used to improve covers and category classification, including Kindle editions when metadata is available.</li>
              <li>Re-importing is safe: matching books are updated instead of duplicated.</li>
              <li>NovelTribe detects Goodreads and Libby/OverDrive files automatically and maps Libby tags, loan status, dates, and formats.</li>
              <li>Open Edit on the Tracker to change title, author, ISBN, genres, status, rating, review, finish date, format, or shelves.</li>
            </ul>
          </div>
          <div className="rounded-[24px] border border-amber-100/10 bg-[#1c1614] p-6">
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
