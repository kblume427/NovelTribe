"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import ShareNovelTribe from "@/components/share-noveltribe";
import { trackEvent } from "@/lib/analytics";
import { allGenres, getBookCategories, starterBooks, type BookRecord } from "@/lib/recommendations";

type BookStatus = "Read" | "Currently Reading" | "Want to Read";

type Book = BookRecord;

type GoogleBookResult = {
  id: string;
  title: string;
  author: string;
  categories?: string[];
  thumbnail?: string;
  isbn?: string;
};

const defaultForm = {
  title: "",
  author: "",
  genre: "Fantasy",
  status: "Read" as BookStatus,
  rating: 5,
  review: "",
};

export default function Home() {
  const [books, setBooks] = useState<Book[]>(starterBooks);
  const [form, setForm] = useState(defaultForm);
  const [editingBookId, setEditingBookId] = useState<string | number | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GoogleBookResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySort, setLibrarySort] = useState("newest");
  const [manualCoverUrl, setManualCoverUrl] = useState<string | null>(null);
  const [manualCoverIsbn, setManualCoverIsbn] = useState<string | null>(null);
  const [useManualCover, setUseManualCover] = useState(false);
  const [communityApprovedCover, setCommunityApprovedCover] = useState(false);
  const [isFindingManualCover, setIsFindingManualCover] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<Array<{ book: Book; coverUrl: string }>>([]);
  const [isFindingMissingCovers, setIsFindingMissingCovers] = useState(false);

  useEffect(() => {
    const title = form.title.trim();
    const author = form.author.trim();
    if (!title || !author || editingBookId !== null) {
      setManualCoverUrl(null);
      setManualCoverIsbn(null);
      setUseManualCover(false);
      setCommunityApprovedCover(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsFindingManualCover(true);
      try {
        const response = await fetch(`/api/books/search?q=${encodeURIComponent(`${title} ${author}`)}`);
        const payload = await response.json();
        const match = payload.items?.find((item: { volumeInfo?: { title?: string; imageLinks?: { thumbnail?: string; smallThumbnail?: string }; industryIdentifiers?: { type: string; identifier: string }[] } }) =>
          item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail,
        );
        const coverUrl = match?.volumeInfo?.imageLinks?.thumbnail ?? match?.volumeInfo?.imageLinks?.smallThumbnail ?? null;
        const isbn = match?.volumeInfo?.industryIdentifiers?.find((identifier: { type: string; identifier: string }) => identifier.type === "ISBN_13")?.identifier
          ?? match?.volumeInfo?.industryIdentifiers?.find((identifier: { type: string; identifier: string }) => identifier.type === "ISBN_10")?.identifier
          ?? null;
        setManualCoverUrl(coverUrl);
        setManualCoverIsbn(isbn);
        setUseManualCover(false);
        setCommunityApprovedCover(false);
        if (isbn) {
          const approvalResponse = await fetch(`/api/covers/approval?isbn=${encodeURIComponent(isbn)}`);
          const approval = await approvalResponse.json();
          if (approval.approved && approval.cover_url) {
            setManualCoverUrl(approval.cover_url);
            setUseManualCover(true);
            setCommunityApprovedCover(true);
          }
        }
      } catch {
        setManualCoverUrl(null);
      } finally {
        setIsFindingManualCover(false);
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [form.title, form.author, editingBookId]);

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

  const readGenres = useMemo(
    () => Array.from(new Set(books.filter((book) => book.status === "Read").flatMap(getBookCategories))),
    [books],
  );
  const availableGenres = useMemo(
    () => Array.from(new Set([...allGenres, ...books.flatMap(getBookCategories).filter(Boolean)])),
    [books],
  );
  const visibleBooks = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const filtered = books.filter((book) => {
      if (!query) return true;
      return [book.title, book.author, book.isbn, book.review, ...getBookCategories(book)]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });

    return [...filtered].sort((first, second) => {
      if (librarySort === "title") return first.title.localeCompare(second.title);
      if (librarySort === "rating") return second.rating - first.rating || first.title.localeCompare(second.title);
      if (librarySort === "finished") {
        return (second.finished_at ?? "").localeCompare(first.finished_at ?? "");
      }
      return (second.created_at ?? "").localeCompare(first.created_at ?? "");
    });
  }, [books, libraryQuery, librarySort]);

  const totalBooks = books.length;
  const finishedBooks = books.filter((book) => book.status === "Read").length;
  const avgRating =
    books.filter((book) => book.rating > 0).reduce((sum, book) => sum + book.rating, 0) /
    Math.max(books.filter((book) => book.rating > 0).length, 1);
  const missingCoverBooks = books.filter((book) => !book.cover_url);

  const findMissingCovers = async () => {
    setIsFindingMissingCovers(true);
    const candidates: Array<{ book: Book; coverUrl: string }> = [];
    for (const book of missingCoverBooks) {
      const query = book.isbn || `${book.title} ${book.author}`;
      try {
        const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
        const payload = await response.json();
        const coverUrl = payload.items?.find((item: { volumeInfo?: { imageLinks?: { thumbnail?: string; smallThumbnail?: string } } }) =>
          item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail,
        )?.volumeInfo?.imageLinks?.thumbnail;
        if (coverUrl) candidates.push({ book, coverUrl });
      } catch {
        // Keep processing the remaining books when one lookup fails.
      }
    }
    setCoverCandidates(candidates);
    setIsFindingMissingCovers(false);
  };

  const approveMissingCover = async (candidate: { book: Book; coverUrl: string }) => {
    const response = await fetch("/api/books", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...candidate.book, cover_url: candidate.coverUrl }),
    });
    if (response.ok) {
      const payload = await response.json();
      if (payload.book) setBooks((current) => current.map((book) => String(book.id) === String(candidate.book.id) ? payload.book : book));
      setCoverCandidates((current) => current.filter((item) => item.book.id !== candidate.book.id));
    }
  };

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
      review: editingBookId !== null ? books.find((book) => String(book.id) === String(editingBookId))?.review ?? null : null,
      cover_url: editingBookId !== null ? books.find((book) => String(book.id) === String(editingBookId))?.cover_url ?? null : useManualCover ? manualCoverUrl : null,
    };

    setBookError(null);
    let saveSucceeded = false;

    if (editingBookId !== null) {
      const response = await fetch("/api/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookPayload),
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload.book) {
          setBooks((current) =>
            current.map((book) => (String(book.id) === String(editingBookId) ? payload.book : book)),
          );
          saveSucceeded = true;
          trackEvent("book_status_changed", { status: bookPayload.status, category: bookPayload.genre });
          if (bookPayload.status === "Read") trackEvent("book_finished", { category: bookPayload.genre });
          if (bookPayload.rating > 0) trackEvent("book_rated", { rating: bookPayload.rating, category: bookPayload.genre });
          if (bookPayload.review) trackEvent("review_saved", { category: bookPayload.genre });
        } else {
          setBookError("The book could not be saved. Please try again.");
        }
      } else {
        const payload = await response.json().catch(() => null);
        setBookError(payload?.error ?? "The book could not be saved. Please try again.");
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
        saveSucceeded = true;
        trackEvent("book_added", { method: "manual", status: bookPayload.status, category: bookPayload.genre });
      } else {
        const payload = await response.json().catch(() => null);
        setBookError(payload?.error ?? "The book could not be added. Please try again.");
        return;
      }
    }

    if (saveSucceeded) {
      setForm(defaultForm);
      setEditingBookId(null);
    }
  };

  const handleEdit = (book: Book) => {
    setEditingBookId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      status: book.status,
      rating: book.rating,
      review: book.review ?? "",
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
        categories: item.volumeInfo?.categories,
        thumbnail: item.volumeInfo?.imageLinks?.thumbnail,
        isbn: item.volumeInfo?.industryIdentifiers?.find(
          (identifier: { type: string; identifier: string }) => identifier.type === "ISBN_13",
        )?.identifier ?? item.volumeInfo?.industryIdentifiers?.find(
          (identifier: { type: string; identifier: string }) => identifier.type === "ISBN_10",
        )?.identifier,
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
    const importedCategories = result.categories?.filter(Boolean) ?? [];
    const importedGenre = importedCategories[0] || form.genre || "Fantasy";

    const importedBook: Book = {
      id: Date.now(),
      title: result.title,
      author: result.author,
      genre: importedGenre,
      status: "Want to Read",
      rating: 0,
      isbn: result.isbn ?? null,
      cover_url: result.thumbnail ?? null,
      categories: importedCategories.length > 0 ? importedCategories : [importedGenre],
    };

    setBooks((current) => [importedBook, ...current]);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);

    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(importedBook),
    });

    if (response.ok) {
      const payload = await response.json();
      if (payload.book) {
        setBooks((current) => current.map((book) => (book.id === importedBook.id ? payload.book : book)));
        trackEvent("book_imported", { source: "google_books", category: importedBook.genre });
      }
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">NovelTribe</div>
            </div>
          </div>

          <nav className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-zinc-300 md:w-auto md:flex-nowrap md:gap-5">
            <a href="#tracker" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="/reading" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Reading</a>
            <a href="/recommendations" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Recommendations</a>
            <a href="/recommendations#genres" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Genres</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 whitespace-nowrap text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
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
                    {book.cover_url && <img src={book.cover_url} alt="" className="mt-3 h-24 w-16 rounded-lg bg-[#0b1120] object-contain" />}
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
                {editingBookId !== null ? "Edit book" : "Add a book"}
              </div>
              {editingBookId !== null && (
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
                    {availableGenres.map((genre) => (
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

              {form.status === "Read" && (
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Review</span>
                  <textarea
                    value={form.review ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, review: event.target.value.slice(0, 1000) }))}
                    rows={4}
                    maxLength={1000}
                    className="w-full resize-y rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                    placeholder="What stayed with you?"
                  />
                  <div className="mt-2 text-xs text-zinc-500">{(form.review ?? "").length}/1000 characters</div>
                </label>
              )}

              {editingBookId === null && (isFindingManualCover || manualCoverUrl) && (
                <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 sm:flex-row sm:items-center">
                  {manualCoverUrl ? <img src={manualCoverUrl} alt="Google Books cover preview" className="h-20 w-14 rounded-lg bg-[#0b1120] object-contain" /> : <div className="h-20 w-14 animate-pulse rounded-lg bg-white/10" />}
                  <div className="min-w-0 flex-1 text-sm text-zinc-300">
                    <div>{isFindingManualCover ? "Looking for the official cover..." : communityApprovedCover ? "Community-approved cover" : "Official Google Books cover found"}</div>
                    {!isFindingManualCover && manualCoverUrl && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!communityApprovedCover && <button type="button" onClick={async () => {
                          setUseManualCover(true);
                          if (manualCoverIsbn) {
                            await fetch("/api/covers/approval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isbn: manualCoverIsbn, cover_url: manualCoverUrl }) });
                            setCommunityApprovedCover(true);
                          }
                        }} className="rounded-full bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30">Use this cover</button>}
                        {!communityApprovedCover && <button type="button" onClick={() => setUseManualCover(false)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10">Skip cover</button>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:brightness-110"
              >
                {editingBookId !== null ? "Save changes" : "Save to my shelf"}
              </button>
              {bookError && <div className="text-sm text-red-200">{bookError}</div>}
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
                    <div key={result.id} className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center">
                      {result.thumbnail ? (
                        <img src={result.thumbnail} alt={result.title} className="h-16 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/30 text-[10px] uppercase tracking-[0.2em] text-violet-100">
                          Book
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-white">{result.title}</div>
                        <div className="truncate text-sm text-zinc-400">{result.author}</div>
                        {result.categories?.length ? (
                          <div className="mt-1 break-words text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                            {result.categories.join(" / ")}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleImportFromGoogle(result)}
                        className="self-start rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/20 sm:self-auto"
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
            <div className="mb-6 flex flex-col gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Your library</div>
                <h2 className="mt-2 text-2xl font-bold text-white">Recent reads</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  placeholder="Search your library..."
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                />
                <select
                  value={librarySort}
                  onChange={(event) => setLibrarySort(event.target.value)}
                  className="rounded-full border border-white/10 bg-[#0b1120] px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                >
                  <option value="newest">Newest added</option>
                  <option value="title">Title A-Z</option>
                  <option value="rating">Highest rated</option>
                  <option value="finished">Recently finished</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                <span>{visibleBooks.length} books · {readGenres.length} genres tracked</span>
                {missingCoverBooks.length > 0 && <button type="button" onClick={() => void findMissingCovers()} disabled={isFindingMissingCovers} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60">{isFindingMissingCovers ? "Finding covers..." : `Find ${missingCoverBooks.length} missing cover${missingCoverBooks.length === 1 ? "" : "s"}`}</button>}
              </div>
            </div>

            {coverCandidates.length > 0 && <div className="mb-5 space-y-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"><div className="text-sm font-semibold text-white">Review cover matches</div>{coverCandidates.map((candidate) => <div key={candidate.book.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0b1120] p-3 sm:flex-row sm:items-center"><img src={candidate.coverUrl} alt="" className="h-20 w-14 rounded-lg bg-[#111827] object-contain" /><div className="min-w-0 flex-1"><div className="font-medium text-white">{candidate.book.title}</div><div className="text-sm text-zinc-400">{candidate.book.author}</div></div><button type="button" onClick={() => void approveMissingCover(candidate)} className="rounded-full bg-cyan-500/20 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30">Use cover</button></div>)}</div>}

            <div className="space-y-4">
              {visibleBooks.map((book) => (
                <div key={book.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
                  <div>
                    <div className="font-semibold text-white">{book.title}</div>
                    <div className="mt-1 text-sm text-zinc-400">{book.author}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {getBookCategories(book).map((category) => (
                        <span key={category} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">
                          {category}
                        </span>
                      ))}
                    </div>
                    {book.isbn && <div className="mt-1 text-xs text-zinc-500">ISBN {book.isbn}</div>}
                    {book.review && <p className="mt-3 max-w-xl whitespace-pre-line text-sm leading-6 text-zinc-300">{book.review}</p>}
                    {book.status === "Read" && book.finished_at && (
                      <div className="mt-1 text-xs text-emerald-200">
                        Finished {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(book.finished_at))}
                      </div>
                    )}
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
              {visibleBooks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
                  No books match that search.
                </div>
              )}
            </div>
          </div>
        </section>

        <ShareNovelTribe />

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
