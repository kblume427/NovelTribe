"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

import FollowButton from "@/components/follow-button";

type Reader = {
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  preferred_categories: string[] | null;
};

export default function RecommendedReaders() {
  const [readers, setReaders] = useState<Reader[]>([]);
  const [searchResults, setSearchResults] = useState<Reader[]>([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/follows/recommended")
      .then((response) => (response.ok ? response.json() : { profiles: [] }))
      .then((payload) => setReaders(Array.isArray(payload.profiles) ? payload.profiles : []))
      .catch(() => setReaders([]));
  }, []);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;

    setSearching(true);
    setSubmittedQuery(trimmedQuery);
    trackEvent("public_reader_search", { query_length: trimmedQuery.length });
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmedQuery)}`);
      const payload = response.ok ? await response.json() : { profiles: [] };
      setSearchResults(Array.isArray(payload.profiles) ? payload.profiles : []);
    } finally {
      setSearching(false);
    }
  };

  const visibleReaders = submittedQuery ? searchResults : readers;

  return (
    <section className="mt-8 rounded-[32px] border border-white/10 bg-white/4 p-6 md:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Find your people</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Search public readers</h2>
        <p className="mt-2 text-sm text-zinc-400">Find readers who have opted in to public profile discoverability.</p>
        <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={2}
            placeholder="Search by name or username"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#0b1120] px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
          />
          <button type="submit" disabled={searching || query.trim().length < 2} className="rounded-full bg-cyan-500/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50">
            {searching ? "Searching..." : "Search readers"}
          </button>
        </form>
      </div>
      {visibleReaders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-zinc-400">
          {submittedQuery ? `No public readers found for “${submittedQuery}”.` : "No reader recommendations yet. Search for a public reader by name or username."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleReaders.map((reader) => (
          <article key={reader.username} className="rounded-2xl border border-white/10 bg-[#121a2b] p-4">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-500">
                {reader.avatar_url ? (
                  <Image src={reader.avatar_url} alt="" fill sizes="48px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-semibold text-white">
                    {(reader.full_name || reader.username).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={`/u/${encodeURIComponent(reader.username)}`}
                  onClick={() => trackEvent("recommended_reader_clicked")}
                  className="block truncate font-semibold text-white hover:text-cyan-200"
                >
                  {reader.full_name || `@${reader.username}`}
                </a>
                <div className="truncate text-xs text-zinc-500">@{reader.username}</div>
              </div>
              <FollowButton username={reader.username} />
            </div>
            {reader.preferred_categories?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {reader.preferred_categories.slice(0, 3).map((category) => (
                  <span key={category} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300">{category}</span>
                ))}
              </div>
            ) : null}
          </article>
          ))}
        </div>
      )}
    </section>
  );
}
