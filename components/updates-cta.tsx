"use client";

import { useEffect, useState } from "react";

import { trackEvent } from "@/lib/analytics";

export const LATEST_UPDATES_VERSION = "2026-09-15";
const LAST_SEEN_UPDATES_KEY = "noveltribe_last_seen_updates";

export function UpdatesCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(LAST_SEEN_UPDATES_KEY) !== LATEST_UPDATES_VERSION);
  }, []);

  if (!visible) return null;

  return (
    <aside className="mb-6 flex flex-col gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-4 text-cyan-50 shadow-[0_10px_30px_rgba(34,211,238,0.08)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">New in NovelTribe</div>
        <p className="mt-1 text-sm leading-6 text-cyan-50/90">Goodreads imports, cover art, onboarding, and sign-in reliability just got better.</p>
      </div>
      <a
        href="/updates"
        onClick={() => trackEvent("updates_cta_clicked", { version: LATEST_UPDATES_VERSION })}
        className="shrink-0 self-start rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:brightness-110"
      >
        See what&apos;s new
      </a>
    </aside>
  );
}

export function MarkUpdatesVisited() {
  useEffect(() => {
    window.localStorage.setItem(LAST_SEEN_UPDATES_KEY, LATEST_UPDATES_VERSION);
    trackEvent("updates_viewed", { version: LATEST_UPDATES_VERSION });
  }, []);

  return null;
}
