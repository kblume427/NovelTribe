import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import FollowButton from "@/components/follow-button";

interface PublicProfileProps {
  params: Promise<{
    username: string;
  }>;
}

export async function generateMetadata({ params }: PublicProfileProps): Promise<Metadata> {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username, is_public")
    .ilike("username", decodedUsername)
    .maybeSingle();

  if (!profile || !profile.is_public) {
    return {
      title: "Reader Not Found | NovelTribe",
      description: "This reader profile does not exist or is kept private.",
    };
  }

  const name = profile.full_name || `@${profile.username}`;

  return {
    title: `${name} (@${profile.username}) - Reader Profile | NovelTribe`,
    description: `Explore ${name}'s reading journey, favorite genres, and book recommendations on NovelTribe.`,
    alternates: {
      canonical: `https://novel-tribe.com/u/${profile.username}`,
    },
    openGraph: {
      title: `${name} on NovelTribe`,
      description: `Explore ${name}'s reading profile and favorite genres on NovelTribe.`,
      url: `https://novel-tribe.com/u/${profile.username}`,
      siteName: "NovelTribe",
      images: [
        {
          url: "https://novel-tribe.com/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${name}'s reading profile on NovelTribe`,
        },
      ],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} on NovelTribe`,
      description: `Explore ${name}'s reading profile on NovelTribe.`,
      images: ["https://novel-tribe.com/opengraph-image"],
    },
  };
}

export default async function PublicProfilePage({ params }: PublicProfileProps) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);

  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, preferred_categories, is_public, public_library, public_ratings, public_reviews, created_at")
    .ilike("username", decodedUsername)
    .maybeSingle();

  if (!profile || !profile.is_public) {
    notFound();
  }

  const joinYear = profile.created_at ? new Date(profile.created_at).getFullYear() : 2026;
  const categories = Array.isArray(profile.preferred_categories) ? profile.preferred_categories : [];
  const { data: publicBooks } = profile.public_library
    ? await supabase
        .from("books")
        .select("title, author, genre, categories, status, rating, review, finished_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const visibleBooks = (publicBooks ?? []).map((book) => ({
    ...book,
    rating: profile.public_ratings ? book.rating : null,
    review: profile.public_reviews ? book.review : null,
  }));
  const finishedCount = visibleBooks.filter((book) => book.status === "Read").length;

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Navigation Bar */}
        <header className="mb-10 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full shadow-lg shadow-violet-500/20">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="40px" className="object-cover" />
            </div>
            <span className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">NovelTribe</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110"
            >
              Join NovelTribe
            </Link>
          </div>
        </header>

        {/* Profile Card */}
        <div className="rounded-[32px] border border-amber-100/10 bg-[#1c1614] p-8 shadow-2xl shadow-amber-950/20">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-6">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-amber-400 via-orange-600 to-[#392027] text-3xl font-bold text-white shadow-xl shadow-amber-900/30">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name || profile.username} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {(profile.full_name || profile.username)?.charAt(0)?.toUpperCase() || "R"}
                </div>
              )}
            </div>

            <div className="mt-4 sm:mt-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-0.5 text-xs font-medium text-violet-200">
                Verified Reader
              </div>
              <h1 className="mt-2 text-3xl font-bold text-white">
                {profile.full_name || `@${profile.username}`}
              </h1>
              <p className="text-zinc-400 font-mono text-sm mt-0.5">@{profile.username}</p>
              <div className="mt-4"><FollowButton username={profile.username} /></div>

              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />
                  </svg>
                  Reading since {joinYear}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  NovelTribe Member
                </span>
              </div>
            </div>
          </div>

          {/* Preferred Categories */}
          {categories.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <h2 className="text-xs uppercase tracking-[0.24em] text-zinc-400">Favorite Genres & Categories</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.public_library && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xs uppercase tracking-[0.24em] text-zinc-400">Shared reading shelf</h2>
                  <p className="mt-2 text-sm text-zinc-500">{visibleBooks.length} books tracked · {finishedCount} finished</p>
                </div>
              </div>
              {visibleBooks.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-zinc-400">No books shared yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleBooks.map((book) => {
                    const bookCategories = Array.isArray(book.categories) && book.categories.length > 0 ? book.categories : [book.genre];
                    return (
                      <div key={`${book.title}-${book.author}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-white">{book.title}</h3>
                            <p className="mt-1 text-sm text-zinc-400">{book.author}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {bookCategories.map((category) => <span key={category} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">{category}</span>)}
                            </div>
                          </div>
                          <span className="text-xs text-violet-200">{book.status}</span>
                        </div>
                        {book.rating !== null && <div className="mt-3 text-sm text-amber-300">{book.rating}/5 rating</div>}
                        {book.review && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-300">{book.review}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Community Teaser & Call to Action */}
          <div className="mt-8 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-cyan-500/10 to-transparent p-6 text-center sm:text-left sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h3 className="font-semibold text-white">Track your reading with NovelTribe</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-300">
                Organize your library, get personalized recommendations, and connect with fellow readers.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-4 inline-block shrink-0 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-slate-900 shadow-md transition hover:bg-zinc-200 sm:mt-0"
            >
              Get Started Free
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-zinc-500">
          Want your own reader profile?{" "}
          <Link href="/login" className="text-violet-400 hover:underline">
            Sign up for free
          </Link>{" "}
          or learn more on our{" "}
          <Link href="/about" className="text-violet-400 hover:underline">
            About page
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
