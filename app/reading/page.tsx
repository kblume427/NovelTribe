"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { getBookCategories, starterBooks, type BookRecord } from "@/lib/recommendations";
import { trackEvent } from "@/lib/analytics";
import { createSupabaseClient } from "@/lib/supabase/client";
import { isFeatureEnabled, resolveFeatureFlags, type FeatureFlags } from "@/lib/featureFlags";
import { calculateDailyPace, estimateBookCompletion } from "@/lib/velocity";
import { calculateStreak, type ReadingSession } from "@/lib/sessions";

export default function CurrentlyReadingPage() {
  const [books, setBooks] = useState<BookRecord[]>(starterBooks.filter((book) => book.status === "Currently Reading"));
  const [loading, setLoading] = useState(true);
  const [profileFlags, setProfileFlags] = useState<FeatureFlags | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [totalMinutes, setTotalMinutes] = useState<number>(0);

  // Quick session logger state
  const [loggingBookId, setLoggingBookId] = useState<string | number | null>(null);
  const [sessionDuration, setSessionDuration] = useState("30");
  const [sessionPages, setSessionPages] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [expandedTimelineBookId, setExpandedTimelineBookId] = useState<string | number | null>(null);

  // Velocity & progress updates
  const [updatingPageBookId, setUpdatingPageBookId] = useState<string | number | null>(null);
  const [tempCurrentPage, setTempCurrentPage] = useState("");
  const [tempTotalPages, setTempTotalPages] = useState("");
  const [isSavingPages, setIsSavingPages] = useState(false);

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

  useEffect(() => {
    const supabase = createSupabaseClient();
    let active = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("feature_flags")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      const flags = resolveFeatureFlags(profileRow?.feature_flags);
      setProfileFlags(flags);

      if (flags.reading_sessions) {
        fetch("/api/sessions")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!active || !data) return;
            setSessions(data.sessions ?? []);
            setStreak(data.streak ?? 0);
            setTotalMinutes(data.totalMinutes ?? 0);
          })
          .catch(() => undefined);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleLogSession = async (bookId: string | number) => {
    setIsSubmittingSession(true);
    setSessionError(null);

    const payload = {
      book_id: String(bookId),
      duration_minutes: sessionDuration ? parseInt(sessionDuration, 10) : null,
      pages_read: sessionPages ? parseInt(sessionPages, 10) : null,
      notes: sessionNotes.trim() || null,
      session_date: new Date().toISOString().slice(0, 10),
    };

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setSessionError(data.error ?? "Failed to save session.");
        return;
      }

      if (data.session) {
        setSessions((curr) => [data.session, ...curr]);
        setTotalMinutes((curr) => curr + (data.session.duration_minutes ?? 0));
        // refresh streak
        const updatedDates = [data.session.session_date, ...sessions.map((s) => s.session_date)];
        setStreak(calculateStreak(updatedDates));
        trackEvent("reading_session_logged", {
          duration_minutes: payload.duration_minutes ?? 0,
          pages_read: payload.pages_read ?? 0,
          has_notes: payload.notes ? 1 : 0,
        });
      }

      setLoggingBookId(null);
      setSessionNotes("");
      setSessionPages("");
    } catch {
      setSessionError("Failed to save session. Please try again.");
    } finally {
      setIsSubmittingSession(false);
    }
  };

  const handleUpdatePages = async (book: BookRecord) => {
    setIsSavingPages(true);
    const curr = tempCurrentPage !== "" ? Math.max(0, parseInt(tempCurrentPage, 10)) : book.current_page ?? 0;
    const total = tempTotalPages !== "" ? Math.max(1, parseInt(tempTotalPages, 10)) : book.total_pages ?? null;

    try {
      const res = await fetch("/api/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...book, current_page: curr, total_pages: total }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.book) {
          setBooks((current) => current.map((b) => (String(b.id) === String(book.id) ? payload.book : b)));
          trackEvent("reading_progress_updated", {
            current_page: curr,
            total_pages: total ?? undefined,
          });
        }
      }
    } finally {
      setIsSavingPages(false);
      setUpdatingPageBookId(null);
    }
  };

  const dailyPace = calculateDailyPace(sessions);

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
            <a href="/features" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Features</a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-violet-100 transition hover:bg-violet-500/15 hover:text-white">Profile</a>
          </nav>
        </header>

        <section className="rounded-[32px] border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-[#1b1514] to-[#191922] p-6 shadow-2xl shadow-amber-950/20 md:p-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Your active shelf</div>
              <h1 className="mt-2 text-4xl font-bold text-white">Currently reading</h1>
              <p className="mt-2 max-w-xl text-zinc-300">Keep the books in progress close at hand, log reading sessions, and build your daily habit.</p>
            </div>

            {profileFlags && isFeatureEnabled(profileFlags, "reading_sessions") && (
              <div className="flex flex-col gap-2 rounded-2xl border border-violet-500/30 bg-[#0b1120]/90 p-4 shadow-lg sm:min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-violet-300">Daily Streak</div>
                    <div className="text-xl font-black text-white">{streak} {streak === 1 ? "day" : "days"}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[11px] text-zinc-400">
                  {totalMinutes > 0 && <span>⏱️ {totalMinutes} total mins logged</span>}
                  {profileFlags && isFeatureEnabled(profileFlags, "reading_velocity") && (
                    <span className="text-cyan-300 font-medium">⚡ Pace: ~{dailyPace} pages/day</span>
                  )}
                </div>
              </div>
            )}
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
              {books.map((book) => {
                const bookSessions = sessions.filter((s) => String(s.book_id) === String(book.id));
                const isLogging = loggingBookId === book.id;
                const isTimelineExpanded = expandedTimelineBookId === book.id;

                return (
                  <article key={book.id} className="flex flex-col justify-between rounded-[26px] border border-amber-100/10 bg-[#1c1614] p-5">
                    <div>
                      {book.cover_url ? (
                        <img src={book.cover_url} alt="" className="mb-5 h-36 w-full rounded-2xl bg-[#0b1120] object-contain" />
                      ) : (
                        <div className="mb-5 h-36 rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500" />
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.2em] text-cyan-200">Currently Reading</span>
                        <span className="text-sm font-medium text-amber-300">{book.rating}/5 rating</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{book.title}</h2>
                      <p className="mt-1 text-zinc-400">{book.author}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getBookCategories(book).map((category) => (
                          <span key={category} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">{category}</span>
                        ))}
                      </div>

                      {/* Reading velocity & progress */}
                      {profileFlags && isFeatureEnabled(profileFlags, "reading_velocity") && (
                        <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b1120] p-3 text-xs">
                          {book.total_pages ? (
                            <div>
                              <div className="flex items-center justify-between text-zinc-300 mb-1.5">
                                <span className="font-medium text-white">
                                  Page {book.current_page ?? 0} of {book.total_pages}
                                </span>
                                <span className="font-semibold text-cyan-300">
                                  {estimateBookCompletion(book.current_page, book.total_pages, dailyPace)?.progressPercent ?? 0}%
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-300"
                                  style={{
                                    width: `${estimateBookCompletion(book.current_page, book.total_pages, dailyPace)?.progressPercent ?? 0}%`,
                                  }}
                                />
                              </div>
                              {(() => {
                                const vel = estimateBookCompletion(book.current_page, book.total_pages, dailyPace);
                                if (!vel || vel.daysToFinish <= 0) return null;
                                return (
                                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                                    <span>{vel.remainingPages} pages left</span>
                                    <span className="text-violet-300 font-medium">
                                      ~{vel.daysToFinish} days to finish ({vel.estimatedFinishDate})
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-zinc-400">
                              <span>Set book page count to track pace and finish date</span>
                            </div>
                          )}

                          <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (updatingPageBookId === book.id) {
                                  setUpdatingPageBookId(null);
                                } else {
                                  setUpdatingPageBookId(book.id);
                                  setTempCurrentPage(book.current_page ? String(book.current_page) : "");
                                  setTempTotalPages(book.total_pages ? String(book.total_pages) : "");
                                }
                              }}
                              className="text-[11px] text-cyan-300 hover:underline"
                            >
                              {updatingPageBookId === book.id ? "Cancel page update" : "Update page / progress →"}
                            </button>
                          </div>

                          {updatingPageBookId === book.id && (
                            <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-white/5 pt-2">
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">Current page</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={tempCurrentPage}
                                  onChange={(e) => setTempCurrentPage(e.target.value)}
                                  placeholder="e.g. 150"
                                  className="w-full rounded-lg border border-white/10 bg-[#111827] px-2 py-1 text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-zinc-400 mb-1">Total pages</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={tempTotalPages}
                                  onChange={(e) => setTempTotalPages(e.target.value)}
                                  placeholder="e.g. 380"
                                  className="w-full rounded-lg border border-white/10 bg-[#111827] px-2 py-1 text-xs text-white"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={isSavingPages}
                                onClick={() => handleUpdatePages(book)}
                                className="col-span-2 mt-1 rounded-lg bg-cyan-600 py-1 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                              >
                                {isSavingPages ? "Saving..." : "Save progress"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Reading sessions actions */}
                      {profileFlags && isFeatureEnabled(profileFlags, "reading_sessions") && (
                        <div className="mt-5 border-t border-white/5 pt-4">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setLoggingBookId(isLogging ? null : book.id);
                                setSessionError(null);
                              }}
                              className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-3.5 py-1.5 text-xs font-semibold text-[#20130d] shadow-md transition hover:brightness-110"
                            >
                              {isLogging ? "Cancel" : "⏱️ Log session"}
                            </button>

                            {profileFlags && isFeatureEnabled(profileFlags, "show_session_timeline") && (
                              <button
                                type="button"
                                onClick={() => setExpandedTimelineBookId(isTimelineExpanded ? null : book.id)}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
                              >
                                {isTimelineExpanded ? "Hide timeline" : `Timeline (${bookSessions.length})`}
                              </button>
                            )}
                          </div>

                          {/* Quick session logger form */}
                          {isLogging && (
                            <div className="mt-3 rounded-2xl border border-violet-500/30 bg-[#0b1120] p-4 text-xs">
                              <div className="mb-2 font-semibold text-white">Record reading session</div>
                              <div className="grid grid-cols-2 gap-3 mb-2">
                                <label className="block">
                                  <span className="text-zinc-400 block mb-1">Minutes</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    value={sessionDuration}
                                    onChange={(e) => setSessionDuration(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-[#111827] px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                                    placeholder="30"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-zinc-400 block mb-1">Pages read</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="5000"
                                    value={sessionPages}
                                    onChange={(e) => setSessionPages(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-[#111827] px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    placeholder="e.g. 25"
                                  />
                                </label>
                              </div>
                              <label className="block mb-3">
                                <span className="text-zinc-400 block mb-1">Session notes (optional)</span>
                                <input
                                  type="text"
                                  value={sessionNotes}
                                  onChange={(e) => setSessionNotes(e.target.value)}
                                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-2.5 py-1.5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                  placeholder="Chapters 4-6, thrilling plot twist..."
                                />
                              </label>

                              {sessionError && <div className="mb-2 text-red-300">{sessionError}</div>}

                              <button
                                type="button"
                                disabled={isSubmittingSession}
                                onClick={() => handleLogSession(book.id)}
                                className="w-full rounded-xl bg-violet-600 py-1.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                              >
                                {isSubmittingSession ? "Saving..." : "Save session"}
                              </button>
                            </div>
                          )}

                          {/* Expandable Session Timeline */}
                          {profileFlags && isFeatureEnabled(profileFlags, "show_session_timeline") && isTimelineExpanded && (
                            <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-[#0b1120] p-3 text-xs">
                              <div className="font-semibold text-zinc-300 uppercase tracking-wider text-[10px]">Session history</div>
                              {bookSessions.length === 0 ? (
                                <p className="text-zinc-500">No sessions recorded for this book yet.</p>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                  {bookSessions.map((s) => (
                                    <div key={s.id} className="rounded-xl border border-white/5 bg-[#111827] p-2.5 text-zinc-300">
                                      <div className="flex items-center justify-between font-medium text-white">
                                        <span>📅 {s.session_date}</span>
                                        <span>
                                          {s.duration_minutes ? `⏱️ ${s.duration_minutes}m` : ""}
                                          {s.duration_minutes && s.pages_read ? " · " : ""}
                                          {s.pages_read ? `📄 ${s.pages_read} pages` : ""}
                                        </span>
                                      </div>
                                      {s.notes && <p className="mt-1 text-zinc-400 italic">“{s.notes}”</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
