"use client";

import { useEffect, useState } from "react";

type Activity = {
  id: string;
  title: string;
  author: string;
  event_type: "started" | "finished" | "rated";
  rating: number | null;
  created_at: string;
};

export default function ActivityFeed() {
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/activity/feed")
      .then((response) => (response.ok ? response.json() : { activity: [] }))
      .then((payload) => setActivity(Array.isArray(payload.activity) ? payload.activity : []))
      .catch(() => setActivity([]));
  }, []);

  return (
    <section className="mt-8 rounded-[32px] border border-white/10 bg-white/4 p-6 md:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">From your circle</div>
        <h2 className="mt-2 text-2xl font-bold text-white">Reading activity</h2>
        <p className="mt-2 text-sm text-zinc-400">See what readers you follow are starting, finishing, and rating.</p>
      </div>
      {activity.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-zinc-400">No shared activity yet. Follow a few readers and check back soon.</div>
      ) : (
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {activity.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-[#121a2b] p-4">
              <div className="text-sm text-zinc-300">
                {item.event_type === "started" && "Started reading"}
                {item.event_type === "finished" && "Finished reading"}
                {item.event_type === "rated" && `Rated ${item.rating}/5`}
              </div>
              <div className="mt-1 font-semibold text-white">{item.title}</div>
              <div className="text-sm text-zinc-500">{item.author}</div>
              <time className="mt-2 block text-xs text-zinc-500" dateTime={item.created_at}>
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.created_at))}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
