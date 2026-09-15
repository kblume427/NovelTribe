"use client";

import { useEffect, useState } from "react";

import { trackEvent } from "@/lib/analytics";

const GOODREADS_ALERT_EXPIRES_AT = Date.parse("2026-09-17T06:00:00.000Z");

export default function GoodreadsImportAlert() {
  const [dismissed, setDismissed] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const remainingMs = GOODREADS_ALERT_EXPIRES_AT - Date.now();
    if (remainingMs <= 0) {
      setExpired(true);
      return;
    }

    const timeout = window.setTimeout(() => setExpired(true), remainingMs);
    return () => window.clearTimeout(timeout);
  }, []);

  if (dismissed || expired) return null;

  return (
    <aside className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-50 shadow-[0_10px_30px_rgba(245,158,11,0.08)] sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Goodreads import update</div>
        <p className="mt-1 text-sm leading-6 text-amber-50/90">
          We resolved a major issue with Goodreads library imports. Please re-import your Goodreads library so genre and category information can be refreshed.
        </p>
        <p className="mt-1 text-xs text-amber-200/80">
          Imported after 5:30 PM today? You can disregard this notice.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          trackEvent("goodreads_import_alert_dismissed");
        }}
        className="shrink-0 self-end rounded-full border border-amber-300/30 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-300/10 sm:self-start"
        aria-label="Dismiss Goodreads import update"
      >
        Dismiss
      </button>
    </aside>
  );
}
