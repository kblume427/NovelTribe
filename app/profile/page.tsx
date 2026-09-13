"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseClient } from "@/lib/supabase/client";

type ProfileState = {
  full_name: string;
  username: string;
  avatar_url: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileState>({
    full_name: "",
    username: "",
    avatar_url: "",
  });
  const [email, setEmail] = useState("");
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    finished: 0,
    averageRating: 0,
    favoriteGenre: "N/A",
  });

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      setLoading(false);
      setStatus("Supabase environment variables are not configured.");
      return;
    }

    const supabase = createSupabaseClient();
    setSupabaseReady(true);

    let active = true;

    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        setLoading(false);
        router.push("/login");
        return;
      }

      setEmail(user.email ?? "");
      setProfile((current) => ({
        full_name: current.full_name || user.user_metadata?.full_name || "",
        username: current.username || "",
        avatar_url: current.avatar_url || user.user_metadata?.avatar_url || "",
      }));

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileRow) {
        setProfile({
          full_name: profileRow.full_name ?? "",
          username: profileRow.username ?? "",
          avatar_url: profileRow.avatar_url ?? "",
        });
      }

      const { data: booksData } = await supabase
        .from("books")
        .select("genre, status, rating")
        .eq("user_id", user.id);

      if (booksData) {
        const total = booksData.length;
        const finished = booksData.filter((book) => book.status === "Read").length;
        const ratedBooks = booksData.filter((book) => Number(book.rating) > 0);
        const avgRating =
          ratedBooks.reduce((sum, book) => sum + Number(book.rating), 0) /
          Math.max(ratedBooks.length, 1);

        const genreCounts = booksData.reduce<Record<string, number>>((acc, book) => {
          const genre = book.genre || "Uncategorized";
          acc[genre] = (acc[genre] ?? 0) + 1;
          return acc;
        }, {});

        const favoriteGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

        setStats({
          total,
          finished,
          averageRating: avgRating,
          favoriteGenre,
        });
      }

      setLoading(false);
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  const handleFieldChange = (field: keyof ProfileState, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabaseReady) {
      setStatus("Supabase is not configured yet.");
      return;
    }

    setSaving(true);
    setStatus(null);

    const supabase = createSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus("You need to sign in first.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: profile.full_name.trim(),
          username: profile.username.trim(),
          avatar_url: profile.avatar_url.trim(),
        },
        { onConflict: "id" },
      )
      .select();

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Profile saved.");
    }

    setSaving(false);
  };

  const handleSignOut = async () => {
    if (!supabaseReady) {
      return;
    }

    setSigningOut(true);
    await createSupabaseClient().auth.signOut();
    router.push("/login");
    setSigningOut(false);
  };

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-lg font-bold text-white">
              N
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">NovelTribe</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              Back to library
            </a>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 text-2xl font-bold text-white shadow-lg shadow-violet-500/20">
                {profile.full_name?.charAt(0)?.toUpperCase() || "N"}
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-violet-200">Reader</div>
                <h1 className="mt-2 text-2xl font-bold text-white">
                  {profile.full_name || "Your profile"}
                </h1>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm text-zinc-300">
              <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Email</div>
                <div className="mt-2 break-all text-white">{email || "Not available"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Username</div>
                <div className="mt-2 text-white">{profile.username || "Not set yet"}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Books</div>
                <div className="mt-2 text-2xl font-bold text-white">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Finished</div>
                <div className="mt-2 text-2xl font-bold text-white">{stats.finished}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Avg rating</div>
                <div className="mt-2 text-2xl font-bold text-white">{stats.averageRating ? stats.averageRating.toFixed(1) : "0.0"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Top genre</div>
                <div className="mt-2 text-2xl font-bold text-white">{stats.favoriteGenre}</div>
              </div>
            </div>
          </aside>

          <section className="rounded-[30px] border border-white/10 bg-[#0f172a] p-6">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-[0.24em] text-emerald-200">Profile settings</div>
              <h2 className="mt-2 text-3xl font-bold text-white">Your reading identity</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">Full name</span>
                <input
                  value={profile.full_name}
                  onChange={(event) => handleFieldChange("full_name", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  placeholder="Your name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">Username</span>
                <input
                  value={profile.username}
                  onChange={(event) => handleFieldChange("username", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  placeholder="bookishreader"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">Avatar URL</span>
                <input
                  value={profile.avatar_url}
                  onChange={(event) => handleFieldChange("avatar_url", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                  placeholder="https://example.com/avatar.jpg"
                />
              </label>

              {status && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  {status}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || loading}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
