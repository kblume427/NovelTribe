"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#100e0d] px-6 text-center text-white">
          <div>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="mt-3 text-sm text-zinc-400">Please refresh the page. Our team has been notified.</p>
          </div>
        </main>
      </body>
    </html>
  );
}
