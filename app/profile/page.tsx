"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { allGenres, getBookCategories, type BookRecord } from "@/lib/recommendations";
import { trackEvent } from "@/lib/analytics";
import { createSupabaseClient } from "@/lib/supabase/client";
import SocialInbox from "@/components/social-inbox";
import GoodreadsImportAlert from "@/components/goodreads-import-alert";
import { UpdatesCta } from "@/components/updates-cta";
import { DEFAULT_FEATURE_FLAGS, resolveFeatureFlags, type FeatureFlagKey, type FeatureFlags } from "@/lib/featureFlags";
import { evaluateMilestones } from "@/lib/milestones";
import { exportBooksToCSV, exportBooksToJSON, normalizeImportedCategories, normalizeImportedGenre, parseKindleJSON, parseLibraryCSV } from "@/lib/importExport";

type ProfileState = {
  full_name: string;
  username: string;
  avatar_url: string;
  preferred_categories: string[];
  is_public: boolean;
  public_library: boolean;
  public_ratings: boolean;
  public_reviews: boolean;
  public_activity: boolean;
  reading_goal: number | null;
  feature_flags: FeatureFlags;
};

const FEATURE_TOGGLE_GROUPS: Array<{ heading: string; items: Array<[FeatureFlagKey, string, string]> }> = [
  {
    heading: "Discovery & recommendations",
    items: [
      ["mood_tags", "Mood & vibe tags", "Tag books as cozy, dark, fast-paced, and more to sharpen your recommendations."],
      ["strict_peer_genre_match", "Strict genre matching for peers", "Only surface followed readers whose favorite genres overlap with yours."],
    ],
  },
  {
    heading: "Reading habit tracking",
    items: [
      ["reading_sessions", "Reading sessions & streaks", "Log daily reading sessions and track a streak counter."],
      ["reading_goals", "Reading goals", "Set an annual or monthly reading goal with a progress bar."],
      ["reading_velocity", "Reading pace indicator", "Show pace and estimated completion based on your logging trends."],
      ["format_stats", "Format breakdown", "See stats on physical, digital, and audiobook reading."],
      ["audiobook_format", "Audiobook support", "Track narrator and runtime when logging audiobooks."],
      ["reading_reminders", "Reading reminders", "Get gentle nudges to keep your reading streak going."],
    ],
  },
  {
    heading: "Book entry extras",
    items: [
      ["quote_capture", "Quote capture", "Save favorite quotes and passages from your books."],
      ["custom_shelves", "Custom shelves", "Create your own tags or lists beyond Read, Currently Reading, and Want to Read."],
      ["show_session_timeline", "Session timeline", "Show a chronological log of reading sessions on each book."],
    ],
  },
  {
    heading: "Dashboard display",
    items: [
      ["show_stats_widgets", "Show stats widgets", "Display summary stat cards and streak counters on your dashboard."],
      ["milestones", "Reading milestones", "Track private achievement badges for personal reading milestones."],
    ],
  },
];

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
    public_library: false,
    public_ratings: false,
    public_reviews: false,
    public_activity: false,
    reading_goal: null,
    feature_flags: DEFAULT_FEATURE_FLAGS,
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [email, setEmail] = useState("");
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [formatCounts, setFormatCounts] = useState<{ physical: number; ebook: number; audiobook: number }>({
    physical: 0,
    ebook: 0,
    audiobook: 0,
  });
  const [readingStreak, setReadingStreak] = useState<number>(0);
  const [profileBooks, setProfileBooks] = useState<BookRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    finished: 0,
    averageRating: 0,
    favoriteGenre: "N/A",
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [categoryOptions, setCategoryOptions] = useState(allGenres);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [uniqueBooks, setUniqueBooks] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

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
      let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;

      for (let attempt = 0; attempt < 3 && active && !user; attempt++) {
        try {
          const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
          if (sessionResponse.ok) {
            const payload = await sessionResponse.json();
            user = payload.user ?? null;
          }
        } catch {
          // Fall back to the browser client if the same-origin session request is unavailable.
        }

        if (!user) {
          const { data: { user: browserUser } } = await supabase.auth.getUser();
          user = browserUser;
        }

        if (!user) {
          const { data: { session } } = await supabase.auth.getSession();
          user = session?.user ?? null;
        }

        if (!user && attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      }

      if (!active) return;

      if (!user) {
        setLoading(false);
        setStatus("Your sign-in session could not be verified. Refresh this page or sign in again.");
        return;
      }

      setEmail(user.email ?? "");
      fetch("/api/admin/user-count")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (typeof payload?.totalUsers === "number") setTotalUsers(payload.totalUsers);
          if (typeof payload?.uniqueBooks === "number") setUniqueBooks(payload.uniqueBooks);
        })
        .catch(() => undefined);
      setProfile((current) => ({
        full_name: current.full_name || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""),
        username: current.username || "",
        avatar_url: current.avatar_url || (typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : ""),
        preferred_categories: current.preferred_categories || [],
        is_public: current.is_public ?? false,
        public_library: current.public_library ?? false,
        public_ratings: current.public_ratings ?? false,
        public_reviews: current.public_reviews ?? false,
        public_activity: current.public_activity ?? false,
        reading_goal: current.reading_goal ?? null,
        feature_flags: current.feature_flags ?? DEFAULT_FEATURE_FLAGS,
      }));

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url, preferred_categories, is_public, public_library, public_ratings, public_reviews, public_activity, reading_goal, feature_flags")
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
          public_library: Boolean(profileRow.public_library),
          public_ratings: Boolean(profileRow.public_ratings),
          public_reviews: Boolean(profileRow.public_reviews),
          public_activity: Boolean(profileRow.public_activity),
          reading_goal: typeof profileRow.reading_goal === "number" ? profileRow.reading_goal : null,
          feature_flags: resolveFeatureFlags(profileRow.feature_flags),
        });
      }

      const { data: booksData } = await supabase
        .from("books")
        .select("id, title, author, genre, categories, status, rating, review, quotes, format, total_pages, current_page")
        .eq("user_id", user.id);

      if (booksData) {
        setProfileBooks(booksData as BookRecord[]);
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

        const genreCounts = booksData.reduce<Record<string, { label: string; count: number }>>((acc, book) => {
          const categories = Array.from(new Set(getBookCategories(book).filter(Boolean)));
          for (const category of categories.length > 0 ? categories : ["Uncategorized"]) {
            const key = category.trim().toLowerCase();
            if (!key) continue;
            acc[key] = {
              label: acc[key]?.label ?? category.trim(),
              count: (acc[key]?.count ?? 0) + 1,
            };
          }
          return acc;
        }, {});

        const favoriteGenre = Object.values(genreCounts).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))[0]?.label ?? "N/A";

        const physicalCount = booksData.filter((b) => b.format === "Physical").length;
        const ebookCount = booksData.filter((b) => b.format === "E-Book").length;
        const audiobookCount = booksData.filter((b) => b.format === "Audiobook").length;
        setFormatCounts({ physical: physicalCount, ebook: ebookCount, audiobook: audiobookCount });

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

      fetch("/api/sessions")
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (!active || !payload) return;
          setReadingStreak(payload.streak ?? 0);
        })
        .catch(() => undefined);

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
          public_library: profile.public_library,
          public_ratings: profile.public_ratings,
          public_reviews: profile.public_reviews,
          public_activity: profile.public_activity,
          reading_goal: profile.reading_goal,
          feature_flags: profile.feature_flags,
        },
        { onConflict: "id" },
      )
      .select();

    if (error) {
      setStatus(error.message);
    } else {
      trackEvent("profile_updated", {
        is_public: profile.is_public ? 1 : 0,
        public_library: profile.public_library ? 1 : 0,
        public_ratings: profile.public_ratings ? 1 : 0,
        public_reviews: profile.public_reviews ? 1 : 0,
        public_activity: profile.public_activity ? 1 : 0,
        has_reading_goal: profile.reading_goal ? 1 : 0,
        preferred_categories_count: profile.preferred_categories?.length ?? 0,
      });
      if (profile.reading_goal) {
        trackEvent("reading_goal_updated", { goal: profile.reading_goal });
      }
      setStatus("Profile saved.");
    }

    setSaving(false);
  };

  const handleExport = (format: "json" | "csv") => {
    if (!profileBooks.length) {
      setImportStatus("No books found to export.");
      return;
    }
    const content = format === "json" ? exportBooksToJSON(profileBooks) : exportBooksToCSV(profileBooks);
    const mime = format === "json" ? "application/json" : "text/csv";
    const filename = `noveltribe-library-${new Date().toISOString().slice(0, 10)}.${format}`;

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    trackEvent("library_exported", { format, book_count: profileBooks.length });
    setImportStatus(`Exported ${profileBooks.length} books as ${format.toUpperCase()}.`);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportStatus("Reading file...");
    const importSource = event.target.dataset.importSource === "kindle" || file.name.toLowerCase().endsWith(".json")
      ? "kindle_json"
      : event.target.dataset.importSource === "libby" || /libby|overdrive/i.test(file.name)
      ? "libby"
      : "goodreads_csv";
    trackEvent("library_import_started", { format: importSource });

    try {
      const text = await file.text();
      const parsedBooks = importSource === "kindle_json" ? parseKindleJSON(text) : parseLibraryCSV(text, file.name);

      if (!parsedBooks.length) {
        setImportStatus("Could not find any books in that file. Please ensure it is a valid Kindle JSON, Goodreads CSV, or Libby spreadsheet export.");
        setImporting(false);
        return;
      }

      const sourceLabel = importSource === "kindle_json" ? "Kindle" : importSource === "libby" ? "Libby" : "Goodreads";
      setImportStatus(`Importing and syncing ${parsedBooks.length} ${sourceLabel} books...`);
      let insertedCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;

      for (const b of parsedBooks) {
        try {
          let importBook = b;
          if (b.genre_source === "catalog_fallback") {
            try {
              const searchQuery = b.isbn || `${b.title} ${b.author}`;
              const metadataResponse = await fetch(`/api/books/search?q=${encodeURIComponent(searchQuery)}`);
              if (metadataResponse.ok) {
                const metadataPayload = await metadataResponse.json();
                const metadataCategories = (metadataPayload.items ?? []).flatMap((item: { volumeInfo?: { categories?: string[] } }) =>
                  Array.isArray(item.volumeInfo?.categories) ? item.volumeInfo.categories : [],
                );
                if (metadataCategories.length > 0) {
                  const metadataGenre = normalizeImportedGenre(metadataCategories);
                  const normalizedCategories = normalizeImportedCategories(metadataCategories);
                  importBook = {
                    ...b,
                    genre: metadataGenre,
                    categories: Array.from(new Set([metadataGenre, ...normalizedCategories])).slice(0, 8),
                  };
                }
              }
            } catch {
              // Preserve the parser fallback when catalog metadata is unavailable.
            }
          }

          const res = await fetch("/api/books", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...importBook, upsert: true }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.updated) {
              updatedCount++;
            } else if (result.alreadyExisted) {
              unchangedCount++;
            } else {
              insertedCount++;
            }
          }
        } catch {
          // continue importing remaining items
        }
      }

      const summaryParts = [];
      if (insertedCount > 0) summaryParts.push(`${insertedCount} new added`);
      if (updatedCount > 0) summaryParts.push(`${updatedCount} updated`);
      if (unchangedCount > 0) summaryParts.push(`${unchangedCount} already up to date`);

      const summaryStr = summaryParts.length > 0 ? summaryParts.join(", ") : "0 books processed";
      trackEvent("library_imported", {
        source: importSource,
        total: parsedBooks.length,
        inserted: insertedCount,
        updated: updatedCount,
        unchanged: unchangedCount,
      });
      setImportStatus(`Finished processing ${parsedBooks.length} books (${summaryStr})!`);
      // refresh stats
      const { data: refreshed } = await createSupabaseClient()
        .from("books")
        .select("id, title, author, genre, categories, status, rating, review, quotes, format, total_pages, current_page");
      if (refreshed) {
        setProfileBooks(refreshed as BookRecord[]);
        setStats((prev) => ({
          ...prev,
          total: refreshed.length,
          finished: refreshed.filter((b) => b.status === "Read").length,
        }));
      }
    } catch {
      setImportStatus("Error reading or parsing the CSV file.");
    } finally {
      setImporting(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabaseReady) {
      return;
    }

    setSigningOut(true);
    trackEvent("user_signed_out");
    await createSupabaseClient().auth.signOut();
    router.push("/login");
    setSigningOut(false);
  };

  return (
    <main className="reading-canvas min-h-screen px-6 py-10 text-white">
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
              href="/features"
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/20"
            >
              Feature guide
            </a>
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
              className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110 disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>

        <GoodreadsImportAlert />
        <UpdatesCta />

        <SocialInbox />

        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-amber-400 via-orange-600 to-[#392027] text-2xl font-bold text-white shadow-lg shadow-amber-900/20">
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

            {profile.feature_flags.format_stats && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b1120] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Format breakdown</div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-300">
                  <span>📖 Physical: <strong className="text-white">{formatCounts.physical}</strong></span>
                  <span>📱 E-Book: <strong className="text-white">{formatCounts.ebook}</strong></span>
                  <span>🎧 Audio: <strong className="text-white">{formatCounts.audiobook}</strong></span>
                </div>
              </div>
            )}

            {profile.feature_flags.reading_sessions && (
              <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Reading streak</div>
                    <div className="mt-1 text-2xl font-bold text-white">🔥 {readingStreak} {readingStreak === 1 ? "day" : "days"}</div>
                  </div>
                  <a href="/reading" className="rounded-full bg-amber-500/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/30">
                    Log session →
                  </a>
                </div>
              </div>
            )}

            {profile.feature_flags.reading_goals && (
              <div className="mt-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-violet-300">Annual Reading Goal</div>
                  <span className="text-xs font-semibold text-white">
                    {profile.reading_goal ? `${stats.finished} / ${profile.reading_goal} books` : "No goal set"}
                  </span>
                </div>
                {profile.reading_goal && profile.reading_goal > 0 && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500"
                        style={{ width: `${Math.min(100, Math.round((stats.finished / profile.reading_goal) * 100))}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-zinc-400">
                      {Math.min(100, Math.round((stats.finished / profile.reading_goal) * 100))}% completed
                      {stats.finished >= profile.reading_goal ? " · 🎉 Goal achieved!" : ` · ${profile.reading_goal - stats.finished} books to go`}
                    </div>
                  </div>
                )}
              </div>
            )}

            {profile.feature_flags.milestones && (() => {
              const milestones = evaluateMilestones(profileBooks, readingStreak, profile.reading_goal);
              const unlockedCount = milestones.filter((m) => m.unlocked).length;

              return (
                <div className="mt-3 rounded-2xl border border-violet-500/20 bg-[#0b1120] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-violet-300">Reading Milestones</div>
                    <span className="text-xs font-semibold text-white">{unlockedCount} / {milestones.length} unlocked</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {milestones.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl border p-2.5 transition ${
                          m.unlocked
                            ? "border-violet-500/40 bg-violet-500/10 shadow-sm"
                            : "border-amber-100/5 bg-[#211817]/60 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{m.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className={`text-xs font-semibold truncate ${m.unlocked ? "text-white" : "text-zinc-400"}`}>
                              {m.title}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate">{m.progressText}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {totalUsers !== null && (
              <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">NovelTribe readers</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-2xl font-bold text-white">{totalUsers}</div>
                    <div className="mt-1 text-xs text-zinc-400">Registered readers</div>
                  </div>
                  {uniqueBooks !== null && (
                    <div>
                      <div className="text-2xl font-bold text-white">{uniqueBooks}</div>
                      <div className="mt-1 text-xs text-zinc-400">Unique books tracked</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Data Ownership: Import & Export */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b1120] p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Data ownership</div>
              <p className="mt-1 text-xs text-zinc-400">
                Your data belongs to you. Export your entire library at any time or import books from Goodreads or Libby.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                >
                  📥 Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("json")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                >
                  📥 Export JSON
                </button>
                <label className="cursor-pointer rounded-xl bg-violet-600/30 border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-600/50">
                  <span>{importing ? "Importing..." : "📤 Import Goodreads"}</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    disabled={importing}
                    data-import-source="goodreads_csv"
                    onChange={handleImportCSV}
                    className="hidden"
                  />
                </label>
                <label className="cursor-pointer rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25">
                  <span>{importing ? "Importing..." : "📚 Import Libby"}</span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    disabled={importing}
                    data-import-source="libby"
                    onChange={handleImportCSV}
                    className="hidden"
                  />
                </label>
                <label className="cursor-pointer rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/25">
                  <span>{importing ? "Importing..." : "📖 Import Kindle"}</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={importing}
                    data-import-source="kindle"
                    onChange={handleImportCSV}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="mt-2 text-[11px] text-zinc-500">
                Kindle users: <a href="/kindle-import" className="text-amber-200 underline">open the export instructions</a> to create your JSON file first.
              </p>

              {importStatus && (
                <div className="mt-2.5 text-[11px] text-cyan-300">
                  {importStatus}
                </div>
              )}
            </div>
          </aside>

          <section className="rounded-[30px] border border-amber-100/10 bg-[#1c1614] p-6">
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

              {profile.feature_flags.reading_goals && (
                <label className="block">
                  <span className="mb-2 block text-sm text-zinc-300">Annual reading goal (books)</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={profile.reading_goal ?? ""}
                    onChange={(event) => {
                      const val = event.target.value.trim();
                      setProfile((current) => ({
                        ...current,
                        reading_goal: val === "" ? null : Math.max(1, parseInt(val, 10)),
                      }));
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b1120] px-3 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
                    placeholder="e.g. 25"
                  />
                  <span className="mt-2 block text-xs text-zinc-500">
                    Set a yearly target to display your progress bar on your profile and dashboard.
                  </span>
                </label>
              )}

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
                          const url = `https://novel-tribe.com/u/${encodeURIComponent(profile.username)}`;
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

              <fieldset className="rounded-2xl border border-white/10 bg-[#0b1120] p-4">
                <legend className="px-1 text-sm font-semibold text-white">Public profile details</legend>
                <p className="mt-1 text-xs leading-5 text-zinc-400">Choose what visitors can see. These controls only apply when your profile is public.</p>
                <div className="mt-4 space-y-3">
                  {([
                    ["public_library", "Show my library", "Let visitors see books on your public profile."],
                    ["public_ratings", "Show my ratings", "Include star ratings with public books."],
                    ["public_reviews", "Show my reviews", "Include your short reviews with public books."],
                    ["public_activity", "Show my activity", "Let people you follow see when you start, finish, or rate books."],
                  ] as const).map(([field, label, description]) => (
                    <label key={field} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 px-3 py-3 text-sm text-zinc-200 hover:border-violet-400/40">
                      <input
                        type="checkbox"
                        checked={profile[field]}
                        disabled={!profile.is_public}
                        onChange={(event) => setProfile((current) => ({ ...current, [field]: event.target.checked }))}
                        className="mt-0.5 h-4 w-4 accent-violet-500"
                      />
                      <span><span className="block font-medium text-white">{label}</span><span className="mt-1 block text-xs text-zinc-500">{description}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-2xl border border-white/10 bg-[#0b1120] p-4">
                <legend className="px-1 text-sm font-semibold text-white">Optional features</legend>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Everything here is off by default. Turn on only what you want — the tracker stays simple otherwise.
                </p>
                <div className="mt-4 space-y-5">
                  {FEATURE_TOGGLE_GROUPS.map((group) => (
                    <div key={group.heading}>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-violet-300">{group.heading}</div>
                      <div className="mt-2 space-y-2">
                        {group.items.map(([key, label, description]) => (
                          <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 px-3 py-3 text-sm text-zinc-200 hover:border-violet-400/40">
                            <input
                              type="checkbox"
                              checked={profile.feature_flags[key]}
                              onChange={(event) => {
                                const isChecked = event.target.checked;
                                trackEvent("feature_flag_toggled", { flag: key, enabled: isChecked ? 1 : 0 });
                                setProfile((current) => ({
                                  ...current,
                                  feature_flags: { ...current.feature_flags, [key]: isChecked },
                                }));
                              }}
                              className="mt-0.5 h-4 w-4 accent-violet-500"
                            />
                            <span>
                              <span className="block font-medium text-white">{label}</span>
                              <span className="mt-1 block text-xs text-zinc-500">{description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>

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
                className="w-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-3 font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
