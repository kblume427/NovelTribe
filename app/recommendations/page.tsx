"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { allGenres, getBookCategories, starterBooks, type BookRecord, type Recommendation } from "@/lib/recommendations";
import { createSupabaseClient } from "@/lib/supabase/client";

type RecommendationResponse = {
  recommendations?: Recommendation[];
};

export default function RecommendationsPage() {
  const amazonAssociateTag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ?? "noveltribe-20";
  const [books, setBooks] = useState<BookRecord[]>(starterBooks);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [exploreGenre, setExploreGenre] = useState("For You");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/books")
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.books) && payload.books.length > 0) {
          setBooks(payload.books);
        }
      })
      .catch(() => setBooks(starterBooks));
  }, []);

  useEffect(() => {
    createSupabaseClient()
      .from("profiles")
      .select("preferred_categories")
      .maybeSingle()
      .then(({ data }) => {
        if (Array.isArray(data?.preferred_categories)) {
          setPreferredCategories(data.preferred_categories);
        }
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRecommendations([]);

    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ books, exploreGenre, preferredCategories }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Recommendations are unavailable.");
        return payload as RecommendationResponse;
      })
      .then((payload) => {
        if (Array.isArray(payload.recommendations)) setRecommendations(payload.recommendations);
      })
      .catch((requestError: Error) => {
        if (!controller.signal.aborted) setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [books, exploreGenre, preferredCategories]);

  const availableGenres = useMemo(
    () => Array.from(new Set([...allGenres, ...books.flatMap(getBookCategories).filter(Boolean)])),
    [books],
  );
  const recommendationFilters = ["For You", ...availableGenres];

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <div className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">NovelTribe</div>
          </div>
          <nav className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-zinc-300 md:w-auto md:flex-nowrap md:gap-5">
            <a href="/" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="/recommendations" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 whitespace-nowrap text-violet-100">Recommendations</a>
            <a href="/#genres" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Genres</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 whitespace-nowrap text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <section className="rounded-[32px] border border-white/10 bg-white/4 p-6 md:p-8">
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Recommendation engine</div>
              <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Suggestions built from your taste</h1>
              <p className="mt-3 max-w-2xl text-zinc-300">Explore a personalized shelf of next reads, or narrow the results to one category.</p>
            </div>
            <p className="text-sm text-zinc-300">Showing: <span className="font-semibold text-white">{exploreGenre}</span></p>
          </div>

          <div id="genres" className="mb-8 flex flex-wrap gap-3">
            {recommendationFilters.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setExploreGenre(genre)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  exploreGenre === genre
                    ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-lg shadow-cyan-500/20"
                    : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

          {loading && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-300">Finding your next reads...</div>}
          {!loading && error && <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-amber-100">{error}</div>}
          {!loading && !error && recommendations.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-zinc-300">No recommendations found for this category yet.</div>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommendations.map((book) => (
              <article key={`${book.id}-${book.title}`} className="rounded-[26px] border border-white/10 bg-[#121a2b] p-4">
                <div className="mb-4 h-40 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500" />
                <div className="text-[10px] uppercase tracking-[0.2em] text-violet-200">{book.genre}</div>
                <h2 className="mt-3 text-xl font-semibold text-white">{book.title}</h2>
                <p className="mt-1 text-sm text-zinc-400">{book.author}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{book.reason}</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <a href={`https://www.amazon.com/s?k=${encodeURIComponent(`${book.title} ${book.author}`)}&tag=${encodeURIComponent(amazonAssociateTag)}`} target="_blank" rel="sponsored noopener noreferrer" className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-900">Buy on Amazon</a>
                  <span className="text-xs text-zinc-500">#ad</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
