import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-6 py-20 text-white text-center">
      <div className="text-xs uppercase tracking-[0.25em] text-violet-400">404 Error</div>
      <h1 className="mt-4 text-4xl font-bold md:text-5xl">Reader or Page Not Found</h1>
      <p className="mt-4 max-w-md text-sm text-zinc-400">
        This profile doesn&apos;t exist, is set to private, or the page you are looking for has been moved.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:brightness-110"
        >
          Return Home
        </Link>
        <Link
          href="/recommendations"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/10"
        >
          Explore Books
        </Link>
      </div>
    </main>
  );
}
