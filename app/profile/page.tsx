"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { allGenres } from "@/lib/recommendations";
import { trackEvent } from "@/lib/analytics";
import { createSupabaseClient } from "@/lib/supabase/client";

type ProfileState = {
  full_name: string;
  username: string;
  avatar_url: string;
  preferred_categories: string[];
  is_public: boolean;
};

type ActivityItem = {
  id: string;
  title: string;
  author: string;
  event_type: "started" | "finished" | "rated";
  rating: number | null;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileState>({
    full_name: "",
    username: "",
    avatar_url: "",
    preferred_categories: [],
    is_public: false,
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [email, setEmail] = useState("");
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    finished: 0,
    averageRating: 0,
    favoriteGenre: "N/A",
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState(allGenres);

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
        preferred_categories: current.preferred_categories || [],
        is_public: current.is_public ?? false,
      }));

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url, preferred_categories, is_public")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileRow) {
        setProfile({
          full_name: profileRow.full_name ?? "",
          username: profileRow.username ?? "",
          avatar_url: profileRow.avatar_url ?? "",
          preferred_categories: profileRow.preferred_categories ?? [],
          is_public: Boolean(profileRow.is_public),
        });
      }

      const { data: booksData } = await supabase
        .from("books")
        .select("genre, categories, status, rating")
        .eq("user_id", user.id);

      if (booksData) {
        const bookCategories = booksData.flatMap((book) =>
          Array.isArray(book.categories) && book.categories.length > 0 ? book.categories : [book.genre],
        );
        setCategoryOptions(Array.from(new Set([...allGenres, ...bookCategories.filter(Boolean)])));
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

      const { data: activityData } = await supabase
        .from("reading_activity")
        .select("id, title, author, event_type, rating, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);

      if (activityData) {
        setActivity(activityData as ActivityItem[]);
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatus("Avatar images must be smaller than 5 MB.");
      return;
    }

    setUploadingAvatar(true);
    setStatus(null);

    const supabase = createSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus("You need to sign in first.");
      setUploadingAvatar(false);
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      setStatus(uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    setProfile((current) => ({ ...current, avatar_url: `${data.publicUrl}?v=${Date.now()}` }));
    trackEvent("avatar_uploaded", { file_type: file.type });
    setStatus("Avatar uploaded. Save your profile to keep it.");
    setUploadingAvatar(false);
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
          preferred_categories: profile.preferred_categories,
          is_public: profile.is_public,
        },
        { onConflict: "id" },
      )
      .select();

    if (error) {
      setStatus(error.message);
    } else {
      trackEvent("profile_updated", { is_public: profile.is_public ? 1 : 0 });
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
            <div className="relative h-10 w-10 overflow-hidden rounded-full shadow-lg shadow-violet-500/20">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="40px" className="object-cover" />
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
              <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 text-2xl font-bold text-white shadow-lg shadow-violet-500/20">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Your avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {profile.full_name?.charAt(0)?.toUpperCase() || "N"}
                  </div>
                )}
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

              <div className="rounded-2xl border border-white/10 bg-[#0b1120] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label htmlFor="is_public_toggle" className="text-sm font-semibold text-white cursor-pointer">
                      Make Profile Public
                    </label>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      When enabled, other readers can view your profile, preferred genres, and stats at{" "}
                      <span className="text-violet-300">novel-tribe.com/u/{profile.username || "yourname"}</span>.
                      Your library remains private unless explicitly shared.
                    </p>
                  </div>
                  <input
                    id="is_public_toggle"
                    type="checkbox"
                    checked={profile.is_public}
                    onChange={(e) => {
                      if (e.target.checked && !profile.username.trim()) {
                        setStatus("Please set a username before making your profile public.");
                        return;
                      }
                      setProfile((current) => ({ ...current, is_public: e.target.checked }));
                    }}
                    className="h-5 w-5 mt-1 cursor-pointer accent-violet-500 rounded"
                  />
                </div>

                {profile.username && (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs">
                    <span className="text-zinc-400 truncate">
                      Link: <span className="text-white font-mono">/u/{profile.username}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/u/${encodeURIComponent(profile.username)}`;
                          navigator.clipboard.writeText(url);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-300 hover:bg-white/10 hover:text-white"
                      >
                        {copiedLink ? "Copied!" : "Copy link"}
                      </button>
                      {profile.is_public && (
                        <a
                          href={`/u/${encodeURIComponent(profile.username)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-violet-500/20 px-2.5 py-1 text-violet-200 hover:bg-violet-500/30"
                        >
                          View public card →
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <fieldset>
                <legend className="mb-2 block text-sm text-zinc-300">Categories you enjoy</legend>
                <p className="mb-3 text-xs leading-5 text-zinc-500">
                  These preferences help shape For You recommendations alongside your library and ratings.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categoryOptions.map((category) => {
                    const selected = profile.preferred_categories.includes(category);
                    return (
                      <label key={category} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#0b1120] px-3 py-2 text-sm text-zinc-200 transition hover:border-violet-400/40">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setProfile((current) => ({
                            ...current,
                            preferred_categories: selected
                              ? current.preferred_categories.filter((item) => item !== category)
                              : [...current.preferred_categories, category],
                          }))}
                          className="h-4 w-4 accent-violet-500"
                        />
                        {category}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-sm text-zinc-300">Avatar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar || loading}
                  className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-sm text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-violet-500/20 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-100 hover:file:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="mt-2 block text-xs text-zinc-500">
                  {uploadingAvatar ? "Uploading avatar..." : "PNG, JPG, or GIF up to 5 MB"}
                </span>
              </label>

              {status && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  {status}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || loading || uploadingAvatar}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          </section>
        </div>

        <section className="mt-8 rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-200">Private activity</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Your reading timeline</h2>
            <p className="mt-2 text-sm text-zinc-400">Only you can see this activity. Social sharing can come later.</p>
          </div>

          {activity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0b1120] p-4 text-sm text-zinc-400">
              Your reading activity will appear here as you start, finish, and rate books.
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#0b1120] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm text-zinc-300">
                      {item.event_type === "started" && "Started reading"}
                      {item.event_type === "finished" && "Finished reading"}
                      {item.event_type === "rated" && `Rated ${item.rating}/5`}
                    </div>
                    <div className="mt-1 font-semibold text-white">{item.title}</div>
                    <div className="text-sm text-zinc-500">{item.author}</div>
                  </div>
                  <time className="text-xs text-zinc-500" dateTime={item.created_at}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.created_at))}
                  </time>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
