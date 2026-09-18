"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("ntb_install_dismissed")) {
      setDismissed(true);
      return;
    }

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as { standalone?: boolean }).standalone;
    if (isStandalone) return;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      trackEvent("pwa_install_banner_shown");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!installEvent || dismissed) return null;

  const handleInstall = async () => {
    trackEvent("pwa_install_prompted");
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    trackEvent("pwa_install_result", { outcome: choice.outcome });
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    window.localStorage.setItem("ntb_install_dismissed", "1");
    setDismissed(true);
    trackEvent("pwa_install_dismissed");
  };

  return (
    <aside className="mb-6 flex flex-col gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-cyan-50 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Install NovelTribe</div>
        <p className="mt-1 text-sm leading-6 text-cyan-50/90">Add NovelTribe to your home screen for quick access to your library.</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleInstall()}
          className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md transition hover:brightness-110"
        >
          Install app
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 hover:text-white"
          aria-label="Dismiss install prompt"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
