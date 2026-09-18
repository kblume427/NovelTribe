"use client";

export default function SentryExamplePage() {
  return (
    <main className="reading-canvas flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <h1 className="text-2xl font-bold">Sentry test page</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Click the button below to throw a test error. Check your Sentry Issues feed to confirm it was captured.
      </p>
      <button
        type="button"
        onClick={() => {
          throw new Error("Sentry test error from /sentry-example-page");
        }}
        className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-3 text-sm font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110"
      >
        Throw test error
      </button>
    </main>
  );
}
