"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { allGenres, getBookCategories, starterBooks, type BookRecord, type Recommendation } from "@/lib/recommendations";
import { buildAmazonBookUrl } from "@/lib/affiliate";
import { createSupabaseClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import RecommendedReaders from "@/components/recommended-readers";
import ActivityFeed from "@/components/activity-feed";
import CircleReviews from "@/components/circle-reviews";

type RecommendationResponse = {
  recommendations?: Recommendation[];
  source?: string;
};

function formatSourceLabel(source?: string | null): { label: string; badgeClass: string } {
  switch (source) {
    case "openai":
      return {
        label: "Curated by AI",
        badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-200",
      };
    case "google_books_open_library":
      return {
        label: "Google Books & Open Library",
        badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
      };
    case "local_fallback":
      return {
        label: "Curated Catalog",
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      };
    default:
      return {
        label: "Personalized Catalog",
        badgeClass: "border-white/10 bg-white/5 text-zinc-300",
      };
  }
}

export default function RecommendationsPage() {
  const amazonAssociateTag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ?? "noveltribe-20";
  const [books, setBooks] = useState<BookRecord[]>(starterBooks);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [exploreGenre, setExploreGenre] = useState("For You");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingBookKey, setSavingBookKey] = useState<string | null>(null);
  const [savedBookKeys, setSavedBookKeys] = useState<Record<string, string>>({});
  const [dismissedTitles, setDismissedTitles] = useState<Set<string>>(new Set());

  useEffect(() => {
        fetch("/api/recommend/dismiss").then((response) => response.json()).then((payload) => setDismissedTitles(new Set(payload.titles ?? []))).catch(() => undefined);
      }, []);

      useEffect(() => {
      setRecommendations([]);
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

  const fetchRecommendations = useCallback(
    async (bypassCache = false) => {
      if (bypassCache) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            books,
            exploreGenre,
            preferredCategories,
            refresh: bypassCache,
            refreshSeed: bypassCache ? Date.now() : 0,
          }),
        });

        const payload = (await response.json()) as RecommendationResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Recommendations are unavailable right now.");
        }

        if (Array.isArray(payload.recommendations)) {
          setRecommendations(payload.recommendations);
          setSource(payload.source ?? null);
          setLastUpdated(new Date());
          trackEvent("recommendations_viewed", {
            mode: exploreGenre,
            count: payload.recommendations.length,
            refreshed: bypassCache ? 1 : 0,
          });
          if (payload.source) {
            trackEvent("recommendation_source_used", {
              source: payload.source,
              mode: exploreGenre,
              refreshed: bypassCache ? 1 : 0,
            });
          }
        }
      } catch (requestError: unknown) {
        const message = requestError instanceof Error ? requestError.message : "Failed to load recommendations.";
        setError(message);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [books, exploreGenre, preferredCategories],
  );

  useEffect(() => {
    fetchRecommendations(false);
  }, [fetchRecommendations]);

  const availableGenres = useMemo(
    () => Array.from(new Set([...allGenres, ...books.flatMap(getBookCategories).filter(Boolean)])),
    [books],
  );
  const recommendationFilters = ["For You", ...availableGenres];

  const addRecommendationToLibrary = async (book: Recommendation, status: "Read" | "Want to Read") => {
    const bookKey = `${book.id}-${book.title}`;
    setSavingBookKey(bookKey);
    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: book.title,
        author: book.author,
        genre: book.genre,
        categories: [book.genre],
        status,
        rating: status === "Read" ? 5 : 0,
        cover_url: book.cover_url ?? null,
      }),
    });

    if (response.ok) {
      setSavedBookKeys((current) => ({ ...current, [bookKey]: status }));
      trackEvent("book_added", { method: "recommendation", status, category: book.genre });
    }
    setSavingBookKey(null);
  };

  const dismissRecommendation = async (book: Recommendation) => {
    await fetch("/api/recommend/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: book.title }) });
    setDismissedTitles((current) => new Set([...current, book.title]));
    setRecommendations((current) => current.filter((item) => item.title !== book.title));
    trackEvent("recommendation_dismissed", { category: book.genre });
  };

  return (
    <main className="reading-canvas min-h-screen text-white">
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
            <a href="/reading" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Reading</a>
            <a href="/recommendations" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 whitespace-nowrap text-violet-100">Recommendations</a>
            <a href="/features" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Features</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 whitespace-nowrap text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <section className="rounded-[32px] border border-white/10 bg-white/4 p-6 md:p-8">
          <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Recommendation engine</div>
              <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Suggestions built from your taste</h1>
              <p className="mt-3 max-w-2xl text-zinc-300">
                Explore a personalized shelf of next reads, or narrow the results to one category.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center md:flex-col md:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-zinc-300">
                  Showing: <span className="font-semibold text-white">{exploreGenre}</span>
                </span>
                {source && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      formatSourceLabel(source).badgeClass
                    }`}
                  >
                    {formatSourceLabel(source).label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="text-xs text-zinc-400">
                    Updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("recommendations_refresh_clicked", { category: exploreGenre });
                    void fetchRecommendations(true);
                  }}
                  disabled={loading || isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/15 bg-amber-100/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-amber-100/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  title="Bypass cache and generate fresh suggestions"
                >
                  <svg
                    className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                  <span>{isRefreshing ? "Refreshing..." : "Refresh suggestions"}</span>
                </button>
              </div>
            </div>
          </div>

          <div id="genres" className="mb-8 flex flex-wrap gap-3">
            {recommendationFilters.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => {
                  setExploreGenre(genre);
                  trackEvent("recommendation_filter_selected", { category: genre });
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  exploreGenre === genre
                    ? "bg-gradient-to-r from-amber-300 to-orange-500 text-[#20130d] shadow-lg shadow-amber-900/25"
                    : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

          {loading && <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-300">Finding your next reads...</div>}
          {!loading && error && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-amber-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">Unable to load recommendations</div>
                  <div className="mt-1 text-sm text-amber-200/90">{error}</div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchRecommendations(true)}
                  disabled={isRefreshing}
                  className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black transition hover:bg-amber-300 disabled:opacity-50"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
          {!loading && !error && recommendations.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-zinc-300">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>No recommendations found for this category yet.</span>
                <button
                  type="button"
                  onClick={() => fetchRecommendations(true)}
                  className="text-xs font-medium text-violet-300 underline hover:text-violet-200"
                >
                  Try refreshing
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recommendations.map((book) => (
              <article key={`${book.id}-${book.title}`} className="rounded-[26px] border border-white/10 bg-[#121a2b] p-4">
                {book.cover_url ? (
                  <img src={book.cover_url} alt="" className="mb-4 h-40 w-full rounded-2xl bg-[#0b1120] object-contain" />
                ) : (
                  <div className="mb-4 h-40 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500" />
                )}
                <div className="text-[10px] uppercase tracking-[0.2em] text-violet-200">{book.genre}</div>
                {book.socialProof && <div className="mt-2 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-100">{book.socialProof}</div>}
                <h2 className="mt-3 text-xl font-semibold text-white">{book.title}</h2>
                <p className="mt-1 text-sm text-zinc-400">{book.author}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{book.reason}</p>
                {savedBookKeys[`${book.id}-${book.title}`] ? (
                  <div className="mt-5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-center text-xs font-medium text-emerald-100">
                    Added as {savedBookKeys[`${book.id}-${book.title}`]}
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" disabled={savingBookKey === `${book.id}-${book.title}`} onClick={() => void addRecommendationToLibrary(book, "Want to Read")} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60">Want to Read</button>
                    <button type="button" disabled={savingBookKey === `${book.id}-${book.title}`} onClick={() => void addRecommendationToLibrary(book, "Read")} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60">Add as Read</button>
                    <button type="button" onClick={() => void dismissRecommendation(book)} className="basis-full text-left text-xs text-zinc-500 underline hover:text-zinc-300">Not Interested</button>
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between gap-3">
                  <a href={buildAmazonBookUrl({ title: book.title, author: book.author, isbn: book.isbn, associateTag: amazonAssociateTag })} onClick={() => { trackEvent("recommendation_clicked", { category: book.genre }); trackEvent("affiliate_link_clicked", { category: book.genre, source: "recommendation" }); }} target="_blank" rel="sponsored noopener noreferrer" className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-900">Buy on Amazon</a>
                  <span className="text-xs text-zinc-500">#ad</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <RecommendedReaders />
        <ActivityFeed />
        <CircleReviews />
      </div>
    </main>
  );
}
