"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export default function ShareNovelTribe() {
  const [copied, setCopied] = useState(false);

  const trackShare = (method: string) => {
    trackEvent("share_completed", {
      method,
      content_type: "website",
      item_id: "noveltribe-home",
    });
  };

  const handleShare = async () => {
    const supportsNativeShare = typeof navigator.share === "function";
    trackEvent("share_clicked", { method: supportsNativeShare ? "native" : "copy" });
    const shareData = {
      title: "NovelTribe",
      text: "Track your reading and discover your next obsession with NovelTribe.",
      url: "https://novel-tribe.com",
    };

    if (supportsNativeShare) {
      try {
        await navigator.share(shareData);
        trackShare("native");
      } catch {
        return;
      }
      return;
    }

    await navigator.clipboard.writeText(shareData.url);
    setCopied(true);
    trackEvent("share_link_copied", { method: "copy" });
    trackShare("copy");
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <section className="mb-16 overflow-hidden rounded-[28px] border border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-amber-400/10 p-5 shadow-xl shadow-cyan-500/5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Pass it along</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Know someone who always needs a new book?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
            Share NovelTribe with a fellow reader and help keep the free reading community growing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleShare()}
          className="shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110"
        >
          {copied ? "Link copied" : "Share NovelTribe"}
        </button>
      </div>
    </section>
  );
}
