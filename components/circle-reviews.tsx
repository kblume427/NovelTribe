"use client";

import { useEffect, useState } from "react";

type CircleReview = {
  title: string;
  author: string;
  genre: string;
  cover_url: string | null;
  rating: number | null;
  review: string;
  reviewer: string;
  username?: string;
};

export default function CircleReviews() {
  const [reviews, setReviews] = useState<CircleReview[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activity/reviews")
      .then((response) => (response.ok ? response.json() : { reviews: [] }))
      .then((payload) => setReviews(Array.isArray(payload.reviews) ? payload.reviews : []))
      .catch(() => setReviews([]));
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="mt-8 rounded-[32px] border border-white/10 bg-white/4 p-6 md:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-200">From your circle</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Books your circle loved</h2>
        <p className="mt-2 text-sm text-zinc-400">Highly rated books with reviews from readers you follow.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {reviews.map((item) => {
          const key = `${item.username}-${item.title}`;
          const isExpanded = expanded === key;
          return (
            <article key={key} className="flex gap-4 rounded-2xl border border-white/10 bg-[#121a2b] p-4">
              {item.cover_url ? <img src={item.cover_url} alt="" className="h-28 w-20 shrink-0 rounded-xl bg-[#0b1120] object-contain" /> : <div className="h-28 w-20 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500" />}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200">{item.genre}</div>
                <h3 className="mt-1 font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-zinc-400">{item.author}</p>
                <div className="mt-2 text-sm text-amber-300">{item.rating ? `${item.rating}/5` : "Reviewed"} <span className="text-zinc-500">by {item.reviewer}</span></div>
                <p className={`mt-2 text-sm leading-6 text-zinc-300 ${isExpanded ? "" : "line-clamp-2"}`}>{item.review}</p>
                <button type="button" onClick={() => setExpanded(isExpanded ? null : key)} className="mt-2 text-xs text-cyan-200 underline hover:text-white">
                  {isExpanded ? "Hide review" : "Read full review"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
