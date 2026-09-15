import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About NovelTribe",
  description: "NovelTribe is a free reading tracker for organizing your library and finding your next great book.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">NovelTribe</a>
        <article className="mt-12 space-y-8">
          <header>
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">About the platform</div>
            <h1 className="mt-3 text-4xl font-bold md:text-5xl">A better home for your reading life.</h1>
            <p className="mt-5 text-lg leading-8 text-zinc-300">NovelTribe helps readers keep their library organized, remember what they loved, and discover what to read next.</p>
          </header>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">Track</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Keep finished, current, and future reads in one private library.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">Discover</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Explore recommendations shaped by your categories and ratings.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">Reflect</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Save short reviews and a private timeline of your reading life.</p></div>
          </section>
          <p className="leading-7 text-zinc-300">NovelTribe is free to use and supported through clearly disclosed affiliate links when readers choose to shop for recommended books.</p>
          <a href="/login" className="inline-flex rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-3 font-semibold text-[#20130d]">Start tracking your books</a>
        </article>
      </div>
    </main>
  );
}