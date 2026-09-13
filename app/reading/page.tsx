"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { getBookCategories, starterBooks, type BookRecord } from "@/lib/recommendations";
import { trackEvent } from "@/lib/analytics";

export default function CurrentlyReadingPage() {
  const [books, setBooks] = useState<BookRecord[]>(starterBooks.filter((book) => book.status === "Currently Reading"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/books")
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.books)) {
          const currentBooks = payload.books.filter((book: BookRecord) => book.status === "Currently Reading");
          setBooks(currentBooks);
          trackEvent("currently_reading_viewed", { count: currentBooks.length });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <div className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">NovelTribe</div>
          </div>
          <nav className="flex w-full flex-wrap items-center justify-center gap-2 text-sm text-zinc-300 md:w-auto md:gap-5">
            <a href="/" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="/reading" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Currently Reading</a>
            <a href="/recommendations" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Recommendations</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <section className="rounded-[32px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-[#111827] to-violet-500/10 p-6 shadow-2xl shadow-cyan-500/5 md:p-8">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Your active shelf</div>
            <h1 className="mt-3 text-4xl font-bold text-white">Currently reading</h1>
            <p className="mt-3 max-w-2xl text-zinc-300">Keep the books in progress close at hand, then return to your tracker when you are ready to update a status or rating.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-300">Loading your reading shelf...</div>
          ) : books.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
              <div className="text-lg font-semibold text-white">Nothing in progress yet</div>
              <p className="mt-2 text-sm text-zinc-400">Add a book to your library and set its status to Currently Reading.</p>
              <a href="/#tracker" className="mt-5 inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-sm font-semibold text-white">Open tracker</a>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {books.map((book) => (
                <article key={book.id} className="rounded-[26px] border border-white/10 bg-[#0f172a] p-5">
                  <div className="mb-5 h-36 rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500" />
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">Currently Reading</div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{book.title}</h2>
                  <p className="mt-1 text-zinc-400">{book.author}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {getBookCategories(book).map((category) => (
                      <span key={category} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">{category}</span>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm text-amber-300">{book.rating}/5 rating</span>
                    <a href="/#tracker" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20">Update book</a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
