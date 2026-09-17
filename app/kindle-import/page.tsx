import type { Metadata } from "next";
import Image from "next/image";
import KindleExportLink from "./kindle-export-link";

export const metadata: Metadata = {
  title: "Import Kindle Library | NovelTribe",
  description: "Export your Kindle books from Amazon and bring them into NovelTribe.",
  alternates: { canonical: "/kindle-import" },
};

export default function KindleImportPage() {
  return (
    <main className="reading-canvas min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-6 lg:px-8">
        <header className="mb-12 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-amber-500/20">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <a href="/" className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200">NovelTribe</a>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-300 md:gap-5">
            <a href="/" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Tracker</a>
            <a href="/getting-started" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">Getting started</a>
            <a href="/faq" className="rounded-full px-2 py-1 transition hover:bg-white/5 hover:text-white">FAQ</a>
            <a href="/profile" className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-amber-100 transition hover:bg-amber-400/20">Profile</a>
          </nav>
        </header>

        <section className="border-b border-white/10 pb-14">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">Kindle library import</div>
            <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-6xl">Bring your Kindle shelf into NovelTribe.</h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">Amazon does not provide a normal library export, so this small browser bookmarklet reads the Books page you already have open and downloads a file for you. It does not ask for your Amazon password and it does not send your library anywhere.</p>
          </div>
        </section>

        <section className="grid gap-5 pt-12 lg:grid-cols-3">
          <article className="rounded-[24px] border border-amber-400/20 bg-amber-400/5 p-6 lg:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Use a computer</div>
            <h2 className="mt-3 text-2xl font-bold text-white">Recommended method</h2>
            <ol className="mt-5 space-y-4 text-sm leading-7 text-zinc-300">
              <li><span className="font-semibold text-white">1.</span> Open this page on a desktop or laptop in Chrome, Edge, Firefox, or Safari. Show the bookmarks bar if it is hidden.</li>
              <li><span className="font-semibold text-white">2.</span> Drag the button below to your bookmarks bar. It should appear as a bookmark named “Drag this to your bookmarks bar.”</li>
              <li><span className="font-semibold text-white">3.</span> In the same browser, open Amazon&apos;s <a href="https://www.amazon.com/hz/mycd/myx?pageType=content" target="_blank" rel="noreferrer" className="text-amber-200 underline">Content and Devices Books page</a> and sign in to Amazon there. If Amazon redirects you to a Seller page, return to this step and use the direct link again while signed into your personal Amazon account.</li>
              <li><span className="font-semibold text-white">4.</span> Choose <span className="font-semibold text-white">Books</span>, wait for the book list to appear, then click the NovelTribe bookmark. The bookmarklet exports only the page currently displayed.</li>
              <li><span className="font-semibold text-white">5.</span> Use Amazon&apos;s page controls to go to the next page of books, then run the bookmarklet again. Repeat this for every page in your Kindle library.</li>
              <li><span className="font-semibold text-white">6.</span> Each run downloads a <span className="font-mono text-amber-100">kindle_library.json</span> file. Keep the files and upload them to NovelTribe one at a time from Profile.</li>
            </ol>
            <div className="mt-7">
              <KindleExportLink />
            </div>
          </article>

          <aside className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/5 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Using a phone?</div>
            <h2 className="mt-3 text-2xl font-bold text-white">Use desktop view</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">The bookmarklet needs a bookmarks bar, which mobile browsers usually hide. On your phone, open your browser menu and turn on <span className="font-semibold text-white">Desktop site</span> or <span className="font-semibold text-white">Request desktop website</span>.</p>
            <p className="mt-4 text-sm leading-7 text-zinc-300">If your phone still cannot create or drag a bookmark, use a computer for the export step. You can then sign in to NovelTribe on your phone and upload the downloaded JSON file from Profile.</p>
          </aside>
        </section>

        <section className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Upload to NovelTribe</div>
          <h2 className="mt-3 text-2xl font-bold text-white">Finish the import</h2>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">
            <li><span className="font-semibold text-white">1.</span> Sign in to NovelTribe and open <a href="/profile" className="text-emerald-200 underline">Profile</a>.</li>
            <li><span className="font-semibold text-white">2.</span> Under Data ownership, choose <span className="font-semibold text-white">Import Kindle</span> and select <span className="font-mono text-emerald-100">kindle_library.json</span>.</li>
            <li><span className="font-semibold text-white">3.</span> Kindle books are added as E-Books with a Kindle shelf tag. Books marked read by Amazon are imported as Read; the rest start as Want to Read.</li>
          </ol>
          <p className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2.5 text-sm leading-6 text-amber-100">NovelTribe matches an existing book by ISBN when available, then by title and author, so importing again will not intentionally create duplicate entries.</p>
        </section>
      </div>
    </main>
  );
}
