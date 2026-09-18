"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import ShareNovelTribe from "@/components/share-noveltribe";
import GoodreadsImportAlert from "@/components/goodreads-import-alert";
import { UpdatesCta } from "@/components/updates-cta";
import { buildAmazonBookUrl } from "@/lib/affiliate";
import { trackEvent } from "@/lib/analytics";
import { allGenres, getBookCategories, starterBooks, type BookRecord } from "@/lib/recommendations";
import { createSupabaseClient, fetchWithSupabaseAuth } from "@/lib/supabase/client";
import { MOOD_TAGS, isFeatureEnabled, resolveFeatureFlags, type FeatureFlags } from "@/lib/featureFlags";
import { evaluateMilestones } from "@/lib/milestones";

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
  isbn: "",
  finished_at: "",
  genre: "Fantasy",
  genres: ["Fantasy"] as string[],
  status: "Read" as BookStatus,
  rating: 5,
  review: "",
  mood_tags: [] as string[],
  quotes: [] as string[],
  newQuoteText: "",
  format: "Physical" as "Physical" | "E-Book" | "Audiobook",
  audiobook_narrator: "",
  audiobook_duration: "",
  custom_shelves: [] as string[],
  newShelfInput: "",
  total_pages: "",
  current_page: "",
};

export default function Home() {
  const amazonAssociateTag = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ?? "noveltribe-20";
  const [books, setBooks] = useState<Book[]>(starterBooks);
  const [form, setForm] = useState(defaultForm);
  const [profileFlags, setProfileFlags] = useState<FeatureFlags | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [readingGoal, setReadingGoal] = useState<number | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [loggedToday, setLoggedToday] = useState<boolean>(false);
  const [reminderDismissed, setReminderDismissed] = useState<boolean>(false);
  const [selectedShelfFilter, setSelectedShelfFilter] = useState<string>("All");
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
    const supabase = createSupabaseClient();
    let active = true;

    async function loadAuthenticatedData() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!active) return;
      setIsSignedIn(Boolean(user));
      if (!user) {
        setBooks(starterBooks);
        return;
      }

      fetchWithSupabaseAuth("/api/books")
        .then((response) => response.json())
        .then((payload) => {
          if (Array.isArray(payload.books)) setBooks(payload.books);
        })
        .catch(() => undefined);

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("feature_flags, reading_goal")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      const flags = resolveFeatureFlags(profileRow?.feature_flags);
      setProfileFlags(flags);
      if (typeof profileRow?.reading_goal === "number") {
        setReadingGoal(profileRow.reading_goal);
      }
      if (flags.reading_sessions || flags.reading_reminders) {
        fetch("/api/sessions")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!active || !data) return;
            setStreak(data.streak ?? 0);
            const todayStr = new Date().toISOString().slice(0, 10);
            const hasToday = Array.isArray(data.sessions) && data.sessions.some((s: { session_date?: string }) => s.session_date?.slice(0, 10) === todayStr);
            setLoggedToday(hasToday);
          })
          .catch(() => undefined);
      }
    }

    void loadAuthenticatedData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) void loadAuthenticatedData();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const readGenres = useMemo(
    () => Array.from(new Set(books.filter((book) => book.status === "Read").flatMap(getBookCategories))),
    [books],
  );
  const availableGenres = useMemo(
    () => allGenres,
    [],
  );
  const allShelves = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (Array.isArray(b.custom_shelves)) {
        b.custom_shelves.forEach((s) => set.add(s));
      }
    });
    return Array.from(set);
  }, [books]);

  const visibleBooks = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const filtered = books.filter((book) => {
      if (selectedShelfFilter !== "All") {
        if (!Array.isArray(book.custom_shelves) || !book.custom_shelves.includes(selectedShelfFilter)) {
          return false;
        }
      }
      if (!query) return true;
      return [
        book.title,
        book.author,
        book.isbn,
        book.review,
        book.format,
        book.audiobook_narrator,
        ...(Array.isArray(book.quotes) ? book.quotes : []),
        ...(Array.isArray(book.custom_shelves) ? book.custom_shelves : []),
        ...getBookCategories(book),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });

    return [...filtered].sort((first, second) => {
      if (librarySort === "status") {
        const statusOrder = { "Want to Read": 0, "Currently Reading": 1, Read: 2 };
        return statusOrder[first.status] - statusOrder[second.status] || first.title.localeCompare(second.title);
      }
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
    trackEvent("missing_covers_searched", { count: missingCoverBooks.length });
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
    const response = await fetchWithSupabaseAuth("/api/books", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...candidate.book, cover_url: candidate.coverUrl }),
    });
    if (response.ok) {
      const payload = await response.json();
      if (payload.book) setBooks((current) => current.map((book) => String(book.id) === String(candidate.book.id) ? payload.book : book));
      setCoverCandidates((current) => current.filter((item) => item.book.id !== candidate.book.id));
      trackEvent("missing_cover_approved", { category: candidate.book.genre });
    }
  };

  const approveAllMissingCovers = async () => {
    const toApprove = [...coverCandidates];
    trackEvent("missing_covers_approved_all", { count: toApprove.length });
    for (const candidate of toApprove) {
      try {
        const response = await fetchWithSupabaseAuth("/api/books", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...candidate.book, cover_url: candidate.coverUrl }),
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload.book) {
            setBooks((current) => current.map((b) => String(b.id) === String(candidate.book.id) ? payload.book : b));
          }
        }
      } catch {
        // continue approving rest
      }
    }
    setCoverCandidates([]);
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
      isbn: form.isbn.trim() || null,
      finished_at: form.status === "Read" && form.finished_at ? new Date(form.finished_at).toISOString() : null,
      genre: form.genre,
      categories: Array.from(new Set([form.genre, ...form.genres])).filter(Boolean),
      status: form.status,
      rating: form.rating,
      review: form.review?.trim() || null,
      cover_url: editingBookId !== null ? books.find((book) => String(book.id) === String(editingBookId))?.cover_url ?? null : useManualCover ? manualCoverUrl : null,
      mood_tags: form.mood_tags && form.mood_tags.length > 0 ? form.mood_tags : null,
      quotes: form.quotes && form.quotes.length > 0 ? form.quotes : null,
      format: profileFlags?.format_stats || profileFlags?.audiobook_format ? form.format : null,
      audiobook_narrator: profileFlags?.audiobook_format && form.format === "Audiobook" && form.audiobook_narrator.trim() ? form.audiobook_narrator.trim() : null,
      audiobook_duration: profileFlags?.audiobook_format && form.format === "Audiobook" && form.audiobook_duration.trim() ? form.audiobook_duration.trim() : null,
      custom_shelves: form.custom_shelves && form.custom_shelves.length > 0 ? form.custom_shelves : null,
      total_pages: form.total_pages ? Math.max(1, parseInt(form.total_pages, 10)) : null,
      current_page: form.current_page ? Math.max(0, parseInt(form.current_page, 10)) : null,
    };

    setBookError(null);
    let saveSucceeded = false;

    if (editingBookId !== null) {
      const response = await fetchWithSupabaseAuth("/api/books", {
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
      const response = await fetchWithSupabaseAuth("/api/books", {
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
    trackEvent("book_edit_opened", { category: book.genre, status: book.status });
    setEditingBookId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? "",
      finished_at: book.finished_at ? new Date(book.finished_at).toISOString().slice(0, 10) : "",
      genre: book.genre,
      genres: getBookCategories(book),
      status: book.status,
      rating: book.rating,
      review: book.review ?? "",
      mood_tags: Array.isArray(book.mood_tags) ? book.mood_tags : [],
      quotes: Array.isArray(book.quotes) ? book.quotes : [],
      newQuoteText: "",
      format: (book.format as any) || "Physical",
      audiobook_narrator: book.audiobook_narrator ?? "",
      audiobook_duration: book.audiobook_duration ?? "",
      custom_shelves: Array.isArray(book.custom_shelves) ? book.custom_shelves : [],
      newShelfInput: "",
      total_pages: book.total_pages ? String(book.total_pages) : "",
      current_page: book.current_page !== null && book.current_page !== undefined ? String(book.current_page) : "",
    });
  };

  const handleDelete = async (bookId: string | number) => {
    const targetBook = books.find((b) => b.id === bookId);
    const response = await fetchWithSupabaseAuth("/api/books", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bookId }),
    });

    if (response.ok) {
      trackEvent("book_deleted", { category: targetBook?.genre, status: targetBook?.status });
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
    trackEvent("quick_import_searched", { query_length: query.length });

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
      mood_tags: [],
      quotes: [],
      format: "Physical",
      custom_shelves: [],
    };

    setBooks((current) => [importedBook, ...current]);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);

    const response = await fetchWithSupabaseAuth("/api/books", {
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
    <main className="reading-canvas min-h-screen text-white">
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
            <a href="/features" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Features</a>
            <a href="/getting-started" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">Getting started</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 whitespace-nowrap text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <GoodreadsImportAlert />
        <UpdatesCta />

        {profileFlags && isFeatureEnabled(profileFlags, "reading_reminders") && !loggedToday && !reminderDismissed && (
          <aside aria-label="Daily reading reminder" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/20 via-[#251b18] to-[#16161b] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📖</span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-200">Daily Reading Habit</div>
                <p className="text-sm text-zinc-200">
                  {streak > 0
                    ? `Keep your ${streak}-day reading streak alive! Even 10 minutes today keeps your momentum going.`
                    : "Carve out a few quiet minutes to read today and start a reading streak."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/reading"
                onClick={() => trackEvent("reminder_clicked")}
                className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-md transition hover:brightness-110"
              >
                Log today&apos;s session →
              </a>
              <button
                type="button"
                onClick={() => {
                  setReminderDismissed(true);
                  trackEvent("reminder_dismissed");
                }}
                className="rounded-full border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white"
                aria-label="Dismiss reading reminder"
              >
                ✕
              </button>
            </div>
          </aside>
        )}

        <section className="mb-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-amber-200/15 bg-gradient-to-br from-[#2a211e] via-[#171416] to-[#171923] p-6 shadow-2xl shadow-amber-950/30">
            <div className="mb-4 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.25em] text-violet-100">
              Reading profile
            </div>
            <h1 className="max-w-xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Track the books you read and discover your next obsession.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
              Log the books you’ve finished, keep tabs on your current reads, and let NovelTribe suggest titles based on the genres and stories you already love.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={isSignedIn === false ? "/login" : "#tracker"}
                onClick={() => trackEvent("landing_cta_clicked", { action: isSignedIn === false ? "sign_in_to_start" : "start_library" })}
                className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-3 text-sm font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110"
              >
                {isSignedIn === false ? "Start my private library" : "Start building my library"}
              </a>
              <a
                href={isSignedIn === false ? "/getting-started" : "/profile"}
                onClick={() => trackEvent("landing_cta_clicked", { action: isSignedIn === false ? "learn_how_it_works" : "import_goodreads" })}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
              >
                {isSignedIn === false ? "See how it works" : "Bring in my Goodreads shelf"}
              </a>
              {isSignedIn !== false && (
                <a
                  href="/profile"
                  onClick={() => trackEvent("landing_cta_clicked", { action: "import_libby" })}
                  className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  Bring in my Libby shelf
                </a>
              )}
            </div>

            {(!profileFlags || isFeatureEnabled(profileFlags, "show_stats_widgets")) && (
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
            )}

            {profileFlags && isFeatureEnabled(profileFlags, "reading_goals") && readingGoal && (
              <div className="mt-6 rounded-2xl border border-violet-500/20 bg-[#0b1120]/80 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-violet-300">Reading Goal</span>
                  <span className="font-bold text-white">{finishedBooks} / {readingGoal} books</span>
                </div>
                <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((finishedBooks / readingGoal) * 100))}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{Math.min(100, Math.round((finishedBooks / readingGoal) * 100))}% completed</span>
                  <span>{finishedBooks >= readingGoal ? "🎉 Goal reached!" : `${readingGoal - finishedBooks} remaining`}</span>
                </div>
              </div>
            )}

            {profileFlags && isFeatureEnabled(profileFlags, "reading_sessions") && (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔥</span>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">Daily Reading Streak</div>
                    <div className="text-sm font-bold text-white">{streak} {streak === 1 ? "day" : "days"}</div>
                  </div>
                </div>
                <a href="/reading" className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/30">
                  Log session →
                </a>
              </div>
            )}

            {profileFlags && isFeatureEnabled(profileFlags, "milestones") && (() => {
              const milestones = evaluateMilestones(books, streak, readingGoal);
              const unlocked = milestones.filter((m) => m.unlocked);
              const latest = unlocked[unlocked.length - 1];

              return (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{latest ? latest.icon : "🏆"}</span>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                        {unlocked.length} of {milestones.length} Milestones Unlocked
                      </div>
                      <div className="text-xs text-white">
                        {latest ? `Latest: ${latest.title}` : "Keep reading to unlock badges"}
                      </div>
                    </div>
                  </div>
                  <a href="/profile" className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-100 hover:bg-violet-500/30">
                    View badges →
                  </a>
                </div>
              );
            })()}
          </div>

          <div className="rounded-[28px] border border-amber-100/10 bg-[#171416]/90 p-6 shadow-[0_20px_50px_rgba(50,28,18,0.35)]">
            <div className="mb-5 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-200">Currently reading</div>
              <a href="/reading" className="text-xs text-cyan-300 hover:underline">Open shelf →</a>
            </div>
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
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-amber-100/10 bg-[#171312] p-6 shadow-[0_20px_50px_rgba(50,28,18,0.2)]">
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
                  <span className="mb-2 block text-sm text-zinc-300">ISBN</span>
                  <input
                    value={form.isbn}
                    onChange={(e) => setForm((current) => ({ ...current, isbn: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                    placeholder="ISBN-10 or ISBN-13"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Finished date</span>
                  <input
                    type="date"
                    value={form.finished_at}
                    onChange={(e) => setForm((current) => ({ ...current, finished_at: e.target.value }))}
                    disabled={form.status !== "Read"}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Primary genre</span>
                  <input
                    value={form.genre}
                    onChange={(e) => setForm((current) => ({
                      ...current,
                      genre: e.target.value,
                      genres: e.target.value.trim()
                        ? Array.from(new Set([e.target.value.trim(), ...current.genres]))
                        : current.genres,
                    }))}
                    list="genre-suggestions"
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                    placeholder="Fantasy, Romance, or your own genre"
                  />
                  <datalist id="genre-suggestions">
                    {availableGenres.map((genre) => <option key={genre} value={genre} />)}
                  </datalist>
                  <span className="mt-2 block text-xs text-zinc-500">Select every genre that applies.</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableGenres.map((genre) => {
                      const selected = form.genres.includes(genre);
                      return (
                        <label key={genre} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${selected ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              setForm((current) => {
                                const nextGenres = event.target.checked
                                  ? Array.from(new Set([...current.genres, genre]))
                                  : current.genres.filter((value) => value !== genre);
                                return {
                                  ...current,
                                  genres: nextGenres.length > 0 ? nextGenres : [current.genre],
                                  genre: nextGenres.length > 0 ? nextGenres[0] : current.genre,
                                };
                              });
                            }}
                            className="sr-only"
                          />
                          {genre}
                        </label>
                      );
                    })}
                  </div>
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

              {profileFlags && isFeatureEnabled(profileFlags, "mood_tags") && (
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Mood &amp; vibe tags</span>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_TAGS.map((tag) => {
                      const selected = Array.isArray(form.mood_tags) && form.mood_tags.includes(tag as string);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setForm((current) => {
                            const currentTags = Array.isArray(current.mood_tags) ? [...current.mood_tags] : [];
                            const idx = currentTags.indexOf(tag as string);
                            if (idx >= 0) currentTags.splice(idx, 1);
                            else currentTags.push(tag as string);
                            return { ...current, mood_tags: currentTags };
                          })}
                          className={`rounded-full px-3 py-1 text-sm transition ${selected ? "bg-violet-500/80 text-white" : "border border-white/10 bg-[#0b1120] text-zinc-300 hover:bg-white/5"}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">Tags are optional — use them to improve recommendations.</div>
                </label>
              )}

              {profileFlags && (isFeatureEnabled(profileFlags, "format_stats") || isFeatureEnabled(profileFlags, "audiobook_format")) && (
                <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-4">
                  <span className="mb-2 block text-sm text-zinc-300">Format</span>
                  <div className="flex flex-wrap gap-2">
                    {(["Physical", "E-Book", "Audiobook"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setForm((curr) => ({ ...curr, format: fmt }))}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          form.format === fmt
                            ? "bg-gradient-to-r from-amber-300 to-orange-500 text-[#20130d]"
                            : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                        }`}
                      >
                        {fmt === "Physical" ? "📖 Physical" : fmt === "E-Book" ? "📱 E-Book" : "🎧 Audiobook"}
                      </button>
                    ))}
                  </div>

                  {profileFlags && isFeatureEnabled(profileFlags, "audiobook_format") && form.format === "Audiobook" && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-zinc-400">Narrator</span>
                        <input
                          value={form.audiobook_narrator}
                          onChange={(e) => setForm((curr) => ({ ...curr, audiobook_narrator: e.target.value }))}
                          placeholder="e.g. Stephen Fry"
                          className="w-full rounded-xl border border-amber-100/10 bg-[#211817] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-zinc-400">Duration / Length</span>
                        <input
                          value={form.audiobook_duration}
                          onChange={(e) => setForm((curr) => ({ ...curr, audiobook_duration: e.target.value }))}
                          placeholder="e.g. 11h 45m"
                          className="w-full rounded-xl border border-amber-100/10 bg-[#211817] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {profileFlags && isFeatureEnabled(profileFlags, "custom_shelves") && (
                <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-4">
                  <span className="mb-2 block text-sm text-zinc-300">Custom shelves &amp; tags</span>
                  {form.custom_shelves.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {form.custom_shelves.map((shelf) => (
                        <span key={shelf} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200">
                          {shelf}
                          <button
                            type="button"
                            onClick={() => setForm((curr) => ({ ...curr, custom_shelves: curr.custom_shelves.filter((s) => s !== shelf) }))}
                            className="ml-1 text-cyan-400 hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={form.newShelfInput}
                      onChange={(e) => setForm((curr) => ({ ...curr, newShelfInput: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = form.newShelfInput.trim();
                          if (val && !form.custom_shelves.includes(val)) {
                            setForm((curr) => ({
                              ...curr,
                              custom_shelves: [...curr.custom_shelves, val],
                              newShelfInput: "",
                            }));
                          }
                        }
                      }}
                      placeholder="Add shelf (e.g. Favorites, Book Club, DNF)..."
                      className="min-w-0 flex-1 rounded-xl border border-amber-100/10 bg-[#211817] px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = form.newShelfInput.trim();
                        if (val && !form.custom_shelves.includes(val)) {
                          setForm((curr) => ({
                            ...curr,
                            custom_shelves: [...curr.custom_shelves, val],
                            newShelfInput: "",
                          }));
                        }
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {profileFlags && isFeatureEnabled(profileFlags, "quote_capture") && (
                <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-4">
                  <span className="mb-2 block text-sm text-zinc-300">Saved quotes &amp; passages</span>
                  {form.quotes.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {form.quotes.map((q, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 rounded-xl border border-amber-100/5 bg-[#211817] p-2.5 text-xs text-zinc-300">
                          <span className="italic leading-relaxed">“{q}”</span>
                          <button
                            type="button"
                            onClick={() => setForm((curr) => ({ ...curr, quotes: curr.quotes.filter((_, i) => i !== idx) }))}
                            className="text-zinc-400 hover:text-red-300 shrink-0 ml-2"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={form.newQuoteText}
                      onChange={(e) => setForm((curr) => ({ ...curr, newQuoteText: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = form.newQuoteText.trim();
                          if (val) {
                            setForm((curr) => ({ ...curr, quotes: [...curr.quotes, val], newQuoteText: "" }));
                          }
                        }
                      }}
                      placeholder="Add a memorable passage or line..."
                      className="min-w-0 flex-1 rounded-xl border border-amber-100/10 bg-[#211817] px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = form.newQuoteText.trim();
                        if (val) {
                          setForm((curr) => ({ ...curr, quotes: [...curr.quotes, val], newQuoteText: "" }));
                        }
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                    >
                      Save quote
                    </button>
                  </div>
                </div>
              )}

              {profileFlags && isFeatureEnabled(profileFlags, "reading_velocity") && (
                <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-4">
                  <span className="mb-2 block text-sm text-zinc-300">Page tracking (Reading pace &amp; finish estimator)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">Total pages</span>
                      <input
                        type="number"
                        min="1"
                        value={form.total_pages}
                        onChange={(e) => setForm((curr) => ({ ...curr, total_pages: e.target.value }))}
                        placeholder="e.g. 400"
                        className="w-full rounded-xl border border-amber-100/10 bg-[#211817] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-zinc-400">Current page reached</span>
                      <input
                        type="number"
                        min="0"
                        value={form.current_page}
                        onChange={(e) => setForm((curr) => ({ ...curr, current_page: e.target.value }))}
                        placeholder="e.g. 120"
                        className="w-full rounded-xl border border-amber-100/10 bg-[#211817] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                      />
                    </label>
                  </div>
                </div>
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
                className="w-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-3 font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110"
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
                  className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#20130d] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
                placeholder="Search by Title, Author, or ISBN..."
                className="w-full rounded-2xl border border-white/10 bg-[#101827] px-3 py-2.5 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              />
              <div className="mt-1.5 px-1 text-[11px] text-zinc-400">
                Supports Title, Author, or ISBN-10/13 (Kindle <span className="font-mono text-cyan-300">B0...</span> ASINs are auto-detected via Goodreads CSV import)
              </div>

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
                        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-700/30 text-[10px] uppercase tracking-[0.2em] text-amber-100">
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

          <div className="rounded-[28px] border border-amber-100/10 bg-[#1c1614] p-6 shadow-[0_20px_50px_rgba(50,28,18,0.25)]">
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
                  onChange={(event) => {
                    const newSort = event.target.value;
                    setLibrarySort(newSort);
                    trackEvent("library_sorted", { sort_by: newSort });
                  }}
                  className="rounded-full border border-white/10 bg-[#0b1120] px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                >
                  <option value="newest">Newest added</option>
                  <option value="status">Want/Currently reading first</option>
                  <option value="title">Title A-Z</option>
                  <option value="rating">Highest rated</option>
                  <option value="finished">Recently finished</option>
                </select>
              </div>

              {profileFlags && isFeatureEnabled(profileFlags, "custom_shelves") && allShelves.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-zinc-400">Shelf:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShelfFilter("All");
                      trackEvent("shelf_filter_selected", { shelf: "All" });
                    }}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      selectedShelfFilter === "All"
                        ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/40"
                        : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    All shelves
                  </button>
                  {allShelves.map((shelf) => (
                    <button
                      key={shelf}
                      type="button"
                      onClick={() => {
                        setSelectedShelfFilter(shelf);
                        trackEvent("shelf_filter_selected", { shelf });
                      }}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        selectedShelfFilter === shelf
                          ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/40"
                          : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {shelf}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                <span>{visibleBooks.length} books · {readGenres.length} genres tracked</span>
                {missingCoverBooks.length > 0 && <button type="button" onClick={() => void findMissingCovers()} disabled={isFindingMissingCovers} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60">{isFindingMissingCovers ? "Finding covers..." : `Find ${missingCoverBooks.length} missing cover${missingCoverBooks.length === 1 ? "" : "s"}`}</button>}
              </div>
            </div>

            {coverCandidates.length > 0 && (
              <div className="mb-5 space-y-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Review cover matches ({coverCandidates.length} found)</div>
                  <div className="flex items-center gap-2">
                    {coverCandidates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void approveAllMissingCovers()}
                        className="rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:brightness-110"
                      >
                        Approve all ({coverCandidates.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCoverCandidates([])}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {coverCandidates.map((candidate) => (
                    <div key={candidate.book.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0b1120] p-3 sm:flex-row sm:items-center">
                      <img src={candidate.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded-lg bg-[#211817] object-contain" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-white">{candidate.book.title}</div>
                        <div className="truncate text-xs text-zinc-400">{candidate.book.author}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void approveMissingCover(candidate)}
                        className="shrink-0 rounded-full bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30"
                      >
                        Use cover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    {book.mood_tags && book.mood_tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {book.mood_tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(book.format || book.audiobook_narrator) && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                        {book.format && (
                          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300">
                            {book.format === "Physical" ? "📖 Physical" : book.format === "E-Book" ? "📱 E-Book" : "🎧 Audio"}
                          </span>
                        )}
                        {book.audiobook_narrator && (
                          <span className="text-[11px] text-zinc-400">
                            Narrated by <strong className="text-zinc-200">{book.audiobook_narrator}</strong>
                            {book.audiobook_duration ? ` (${book.audiobook_duration})` : ""}
                          </span>
                        )}
                      </div>
                    )}
                    {Array.isArray(book.custom_shelves) && book.custom_shelves.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {book.custom_shelves.map((shelf) => (
                          <span key={shelf} className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                            🏷️ {shelf}
                          </span>
                        ))}
                      </div>
                    )}
                    {book.isbn && <div className="mt-1 text-xs text-zinc-500">ISBN {book.isbn}</div>}
                    {book.total_pages && (
                      <div className="mt-1 text-xs text-cyan-300 font-medium">
                        📄 Page {book.current_page ?? 0} of {book.total_pages}
                        {book.total_pages > 0 && ` (${Math.min(100, Math.round(((book.current_page ?? 0) / book.total_pages) * 100))}%)`}
                      </div>
                    )}
                    {Array.isArray(book.quotes) && book.quotes.length > 0 && (
                      <div className="mt-3 space-y-1 rounded-xl border border-white/5 bg-[#0b1120] p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-violet-300">Quotes</div>
                        {book.quotes.map((q, i) => (
                          <p key={i} className="text-xs italic text-zinc-300">“{q}”</p>
                        ))}
                      </div>
                    )}
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
                    {book.status === "Want to Read" && (
                      <a
                        href={buildAmazonBookUrl({ title: book.title, author: book.author, isbn: book.isbn, associateTag: amazonAssociateTag })}
                        onClick={() => trackEvent("affiliate_link_clicked", { category: book.genre, source: "library" })}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                        className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-900"
                      >
                        Buy
                      </a>
                    )}
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
