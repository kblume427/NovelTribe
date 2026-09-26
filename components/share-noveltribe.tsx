"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

const shareMessages = [
  {
    id: "reader",
    label: "For a fellow reader",
    text: "Found a cozy home for my reading life: NovelTribe helps me track books and find my next read.",
  },
  {
    id: "discovery",
    label: "For finding your next read",
    text: "Need your next book? NovelTribe tracks what you love and helps you discover what to read next.",
  },
  {
    id: "library",
    label: "For organizing a library",
    text: "I’m organizing my books on NovelTribe: a free reading tracker with Goodreads, Libby, and Kindle imports.",
  },
  {
    id: "simple",
    label: "Keep it simple",
    text: "I’ve been using NovelTribe to keep track of my reading. Thought you might like it too.",
  },
] as const;

export default function ShareNovelTribe() {
  const [copied, setCopied] = useState(false);
  const [messageId, setMessageId] = useState<(typeof shareMessages)[number]["id"]>("reader");

  const selectedMessage = shareMessages.find((message) => message.id === messageId) ?? shareMessages[0];

  const trackShare = (method: string) => {
    trackEvent("share_completed", {
      method,
      content_type: "website",
      item_id: "noveltribe-home",
    });
  };

  const handleShare = async () => {
    const supportsNativeShare = typeof navigator.share === "function";
    trackEvent("share_clicked", { method: supportsNativeShare ? "native" : "copy", variant: selectedMessage.id });
    const shareData = {
      title: "NovelTribe",
      text: selectedMessage.text,
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

    await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
    setCopied(true);
    trackEvent("share_link_copied", { method: "copy", variant: selectedMessage.id });
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
        <div className="flex shrink-0 flex-col gap-3 sm:min-w-64">
          <label className="text-xs font-medium text-zinc-300">
            Message
            <select
              value={messageId}
              onChange={(event) => setMessageId(event.target.value as typeof messageId)}
              className="mt-1.5 block w-full rounded-xl border border-white/10 bg-[#101827] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            >
              {shareMessages.map((message) => (
                <option key={message.id} value={message.id}>{message.label}</option>
              ))}
            </select>
          </label>
          <p className="max-w-sm text-xs leading-5 text-zinc-400">{selectedMessage.text}</p>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110"
          >
            {copied ? "Message and link copied" : "Share NovelTribe"}
          </button>
        </div>
      </div>
    </section>
  );
}
