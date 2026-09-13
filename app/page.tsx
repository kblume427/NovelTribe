"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { allGenres, starterBooks, type BookRecord, type Recommendation } from "@/lib/recommendations";

type BookStatus = "Read" | "Currently Reading" | "Want to Read";

type Book = BookRecord;

type RecommendationResponse = {
  recommendations?: Recommendation[];
};

type GoogleBookResult = {
  id: string;
  title: string;
  author: string;
  category?: string;
  thumbnail?: string;
};

const defaultForm = {
  title: "",
  author: "",
  genre: "Fantasy",
  status: "Read" as BookStatus,
  rating: 5,
};

export default function Home() {
  const amazonAssociateTag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ?? "noveltribe-20";

  const [books, setBooks] = useState<Book[]>(starterBooks);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingBookId, setEditingBookId] = useState<string | number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GoogleBookResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [exploreGenre, setExploreGenre] = useState("Adventure");

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      void handleGoogleSearch();
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    fetch("/api/books")
      .then((response) => response.json())
      .then((payload) => {
        if (Array.isArray(payload.books) && payload.books.length > 0) {
          setBooks(payload.books);
        }
      })
      .catch(() => {
        setBooks(starterBooks);
      });
  }, []);

  useEffect(() => {
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ books, exploreGenre }),
    })
      .then((response) => response.json())
      .then((payload: RecommendationResponse) => {
        if (Array.isArray(payload.recommendations) && payload.recommendations.length > 0) {
          setRecommendations(payload.recommendations);
        }
      })
      .catch(() => {
        setRecommendations([]);
      });
  }, [books, exploreGenre]);

  const readGenres = useMemo(
    () => Array.from(new Set(books.filter((book) => book.status === "Read").map((book) => book.genre))),
    [books],
  );

  const totalBooks = books.length;
  const finishedBooks = books.filter((book) => book.status === "Read").length;
  const avgRating =
    books.filter((book) => book.rating > 0).reduce((sum, book) => sum + book.rating, 0) /
    Math.max(books.filter((book) => book.rating > 0).length, 1);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = form.title.trim();
    const trimmedAuthor = form.author.trim();

    if (!trimmedTitle || !trimmedAuthor) {
      return;
    }

    const bookPayload: Book = {
      id: editingBookId ?? Date.now(),
      title: trimmedTitle,
      author: trimmedAuthor,
      genre: form.genre,
      status: form.status,
      rating: form.rating,
    };

    if (editingBookId) {
      const response = await fetch("/api/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookPayload),
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload.book) {
          setBooks((current) => current.map((book) => (book.id === editingBookId ? payload.book : book)));
        }
      }
    } else {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookPayload),
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload.book) {
          setBooks((current) => [payload.book, ...current]);
        } else {
          setBooks((current) => [bookPayload, ...current]);
        }
      }
    }

    setForm(defaultForm);
    setEditingBookId(null);
  };

  const handleEdit = (book: Book) => {
    setEditingBookId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      status: book.status,
      rating: book.rating,
    });
  };

  const handleDelete = async (bookId: string | number) => {
    const response = await fetch("/api/books", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId }),
    });

    if (response.ok) {
      setBooks((current) => current.filter((book) => book.id !== bookId));
      if (editingBookId === bookId) {
        setForm(defaultForm);
        setEditingBookId(null);
      }
    }
  };

  const handleGoogleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
      const payload = await response.json();

      if (!response.ok) {
        setSearchResults([]);
        setSearchError(payload.error ?? "Google Books search is unavailable.");
        return;
      }

      if (!payload.items) {
        setSearchResults([]);
        return;
      }

      const mapped: GoogleBookResult[] = payload.items.map((item: any) => ({
        id: item.id,
        title: item.volumeInfo?.title ?? "Untitled",
        author: item.volumeInfo?.authors?.join(", ") ?? "Unknown author",
        category: item.volumeInfo?.categories?.[0],
        thumbnail: item.volumeInfo?.imageLinks?.thumbnail,
      }));

      setSearchResults(mapped);
    } catch {
      setSearchResults([]);
      setSearchError("Google Books search is unavailable. Please try again later.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportFromGoogle = async (result: GoogleBookResult) => {
    const normalizedGenre = allGenres.includes(result.category ?? "")
      ? result.category!
      : form.genre || "Fantasy";

    const importedBook: Book = {
      id: Date.now(),
      title: result.title,
      author: result.author,
      genre: normalizedGenre,
      status: "Want to Read",
      rating: 0,
    };

    setBooks((current) => [importedBook, ...current]);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);

    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(importedBook),
    });
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 rounded-full border border-white/10 bg-white/5 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">NovelTribe</div>
            </div>
          </div>

          <nav className="flex items-center gap-5 text-sm text-zinc-300">
            <a href="#tracker" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="#recommendations" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Recommendations</a>
            <a href="#genres" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Genres</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-500/10 via-[#111827] to-cyan-500/10 p-6 shadow-2xl shadow-violet-500/10">
            <div className="mb-4 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.25em] text-violet-100">
              Reading profile
            </div>
            <h1 className="max-w-xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Track the books you read and discover your next obsession.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
              Log the books you’ve finished, keep tabs on your current reads, and let NovelTribe suggest titles based on the genres and stories you already love.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/7 p-4 shadow-lg shadow-violet-500/5">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Books tracked</div>
                <div className="mt-3 text-3xl font-bold text-white">{totalBooks}</div>
              </div>
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/7 p-4 shadow-lg shadow-cyan-500/5">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Finished</div>
                <div className="mt-3 text-3xl font-bold text-white">{finishedBooks}</div>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/7 p-4 shadow-lg shadow-amber-500/5">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Avg rating</div>
                <div className="mt-3 text-3xl font-bold text-white">{avgRating.toFixed(1)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111827]/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.45)]">
            <div className="mb-5 text-xs uppercase tracking-[0.24em] text-cyan-200">Currently reading</div>
            <div className="space-y-4">
              {books.filter((book) => book.status !== "Read").slice(0, 3).map((book) => (
                <div key={book.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div>
                    <div className="font-semibold text-white">{book.title}</div>
                    <div className="text-sm text-zinc-400">{book.author}</div>
                  </div>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100">
                    {book.status}
                  </span>
                </div>
              ))}
              {books.filter((book) => book.status !== "Read").length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-sm text-zinc-400">
                  Add a book to start building your reading rhythm.
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="tracker" className="grid gap-8 pb-16 lg:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-white/4 p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.25em] text-violet-200">
                {editingBookId ? "Edit book" : "Add a book"}
              </div>
              {editingBookId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBookId(null);
                    setForm(defaultForm);
                  }}
                  className="text-sm text-zinc-300 transition hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  placeholder="The Left Hand of Darkness"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">Author</span>
                <input
                  value={form.author}
                  onChange={(e) => setForm((current) => ({ ...current, author: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  placeholder="Ursula K. Le Guin"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Genre</span>
                  <select
                    value={form.genre}
                    onChange={(e) => setForm((current) => ({ ...current, genre: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  >
                    {allGenres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as BookStatus }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  >
                    <option value="Read">Read</option>
                    <option value="Currently Reading">Currently Reading</option>
                    <option value="Want to Read">Want to Read</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">Rating</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.rating}
                  onChange={(e) => setForm((current) => ({ ...current, rating: Number(e.target.value) }))}
                  className="w-full accent-violet-500"
                />
                <div className="mt-2 text-sm text-violet-200">{form.rating} / 5</div>
              </label>

              <button
                type="submit"
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-110"
              >
                {editingBookId ? "Save changes" : "Save to my shelf"}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b1120] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-200">Quick import</div>
                <button
                  type="button"
                  onClick={handleGoogleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleGoogleSearch();
                  }
                }}
                placeholder="Search Google Books..."
                className="w-full rounded-2xl border border-white/10 bg-[#101827] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              />

              {searchQuery.trim() && !isSearching && searchError && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                  {searchError}
                </div>
              )}

              {searchQuery.trim() && !isSearching && !searchError && searchResults.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/3 p-3 text-sm text-zinc-400">
                  No matching titles found. Try a different search.
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  {searchResults.map((result) => (
                    <div key={result.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                      {result.thumbnail ? (
                        <img src={result.thumbnail} alt={result.title} className="h-16 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/30 text-[10px] uppercase tracking-[0.2em] text-violet-100">
                          Book
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-white">{result.title}</div>
                        <div className="truncate text-sm text-zinc-400">{result.author}</div>
                        {result.category && <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">{result.category}</div>}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleImportFromGoogle(result)}
                        className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>

          <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Your library</div>
                <h2 className="mt-2 text-2xl font-bold text-white">Recent reads</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300">
                {readGenres.length} genres tracked
              </div>
            </div>

            <div className="space-y-4">
              {books.map((book) => (
                <div key={book.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
                  <div>
                    <div className="font-semibold text-white">{book.title}</div>
                    <div className="mt-1 text-sm text-zinc-400">{book.author} · {book.genre}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-100">
                      {book.status}
                    </span>
                    <span className="text-sm font-medium text-amber-300">{book.rating}/5</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(book)}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-200 transition hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(book.id)}
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-red-200 transition hover:bg-red-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="genres" className="pb-16">
          <div className="mb-5 text-xs uppercase tracking-[0.25em] text-cyan-200">Explore outside your usual reads</div>
          <div className="flex flex-wrap gap-3">
            {allGenres.map((genre) => (
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
        </section>

        <section id="recommendations" className="rounded-[32px] border border-white/10 bg-white/4 p-6 md:p-8">
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Recommendation engine</div>
              <h2 className="mt-3 text-3xl font-bold text-white">Suggestions built from your current taste</h2>
            </div>
            <p className="text-sm text-zinc-300">Currently exploring: <span className="font-semibold text-white">{exploreGenre}</span></p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {(recommendations.length > 0 ? recommendations : []).map((book) => (
              <article key={`${book.id}-${book.title}`} className="rounded-[26px] border border-white/10 bg-[#121a2b] p-4">
                <div className="mb-4 h-40 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500" />
                <div className="text-[10px] uppercase tracking-[0.2em] text-violet-200">{book.genre}</div>
                <h3 className="mt-3 text-xl font-semibold text-white">{book.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{book.author}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{book.reason}</p>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <a
                    href={`https://www.amazon.com/s?k=${encodeURIComponent(`${book.title} ${book.author}`)}&tag=${encodeURIComponent(amazonAssociateTag)}`}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-900"
                  >
                    Buy on Amazon
                  </a>
                  <span className="text-xs text-zinc-500">#ad</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-[32px] border border-amber-500/20 bg-amber-500/5 p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-amber-200">Affiliate disclosure</div>
              <h2 className="mt-3 text-3xl font-bold text-white">Clear, compliant, and community-first.</h2>
              <p className="mt-4 text-zinc-300">
                Links generated from recommended titles include the required disclosure language and make it easy for readers to support the platform while still keeping the reading experience front and center.
              </p>
            </div>

            <div className="rounded-3xl border border-amber-500/30 bg-black/20 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-100">Required disclosure</div>
              <p className="mt-4 text-base text-zinc-200">
                “As an Amazon Associate, NovelTribe earns from qualifying purchases. The affiliate tag is configured through the site environment and used for compliant product discovery links.”
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
