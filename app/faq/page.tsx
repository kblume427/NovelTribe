import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "FAQ | NovelTribe",
  description: "Answers about NovelTribe privacy, library imports, recommendations, accounts, and reading features.",
  alternates: { canonical: "/faq" },
};

const questions = [
  {
    question: "Is my library private?",
    answer: "Yes. Your library, reviews, reading sessions, and activity are private by default. Public profile, library, ratings, reviews, and activity visibility are separate opt-in controls in Profile.",
  },
  {
    question: "Can I import from Goodreads?",
    answer: "Yes. From Profile, choose Import Goodreads and upload your Goodreads library CSV. ISBNs improve covers and category classification, and matching books are updated instead of duplicated.",
  },
  {
    question: "Can I import from Libby?",
    answer: "Yes. In Libby, open Tags, choose a tag, then Actions → Export Tag → Spreadsheet → Titles. Upload that file with Import Libby in Profile. NovelTribe maps titles, authors, ISBNs, formats, tags, loan status, and dates.",
  },
  {
    question: "What happens if I import the same library twice?",
    answer: "NovelTribe matches by ISBN when available, then by title and author. Existing books are updated with missing or improved information instead of creating duplicate shelf entries.",
  },
  {
    question: "Can I change an imported book?",
    answer: "Yes. Open Edit on the Tracker. You can change the title, author, ISBN, primary genre, multiple categories, status, rating, review, finished date, format, and custom shelves.",
  },
  {
    question: "How do recommendations work?",
    answer: "Recommendations use your library, finished genres, ratings, preferred categories, and optional mood information. You can enable or disable recommendation features in Profile.",
  },
  {
    question: "Do optional features turn on automatically?",
    answer: "No. Optional features such as reading sessions, reminders, goals, moods, quotes, shelves, and milestones are off by default. Enable them in Profile, then click Save profile.",
  },
  {
    question: "Can I use NovelTribe on my phone?",
    answer: "Yes. NovelTribe works in mobile browsers and can be installed as a PWA on supported devices. Sign-in links should be opened in the same browser where you requested them.",
  },
  {
    question: "How do I export my data?",
    answer: "Open Profile and choose Export CSV or Export JSON in the Data ownership section. You can use the export as a backup or review it before importing elsewhere.",
  },
];

export default function FAQPage() {
  return (
    <main className="reading-canvas min-h-screen text-white">
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
            <a href="/faq" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">FAQ</a>
            <a href="/updates" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Updates</a>
          </nav>
        </header>

        <section className="mb-12 border-b border-white/10 pb-12">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Clear answers</div>
          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-tight text-white sm:text-6xl">Questions, without the fine print.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">Find quick answers about privacy, imports, recommendations, and making NovelTribe fit your reading life.</p>
        </section>

        <section className="space-y-3">
          {questions.map((item) => (
            <details key={item.question} className="group rounded-2xl border border-white/10 bg-white/5 p-5 open:bg-white/[0.07]">
              <summary className="cursor-pointer list-none pr-8 text-lg font-semibold text-white marker:hidden [&::-webkit-details-marker]:hidden">{item.question}</summary>
              <p className="mt-3 max-w-3xl leading-7 text-zinc-300">{item.answer}</p>
            </details>
          ))}
        </section>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-white/10 pt-8">
          <a href="/getting-started" className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white">Read Getting Started</a>
          <a href="/profile" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200">Open Profile</a>
          <a href="/feedback" className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100">Report an issue</a>
        </div>
      </div>
    </main>
  );
}
