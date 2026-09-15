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

  useEffect(() => {
    fetch("/api/follows/recommended")
      .then((response) => (response.ok ? response.json() : { profiles: [] }))
      .then((payload) => setReaders(Array.isArray(payload.profiles) ? payload.profiles : []))
      .catch(() => setReaders([]));
  }, []);

  if (readers.length === 0) return null;

  return (
    <section className="mt-8 rounded-[32px] border border-white/10 bg-white/4 p-6 md:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Find your people</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Readers to discover</h2>
        <p className="mt-2 text-sm text-zinc-400">Explore public reader profiles with favorite categories like yours.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {readers.map((reader) => (
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
    </section>
  );
}
