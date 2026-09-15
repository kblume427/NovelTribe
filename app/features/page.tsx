import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Features | NovelTribe",
  description:
    "Explore all the features of NovelTribe: private-first book tracking, reading habits, custom shelves, quotes, mood tags, format stats, and smart recommendations.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  const featureCategories = [
    {
      category: "Reading Habit, Goals & Pace Estimator",
      badge: "Opt-In & Private",
      color: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
      description: "Build a lasting daily reading habit on your own terms with zero vanity pressure.",
      features: [
        {
          title: "Daily Reading Streaks & Sessions",
          icon: "🔥",
          desc: "Log daily reading sessions with minutes spent, pages read, and private session notes. Track your consecutive reading streak across days.",
          flag: "reading_sessions",
        },
        {
          title: "Annual Reading Goals",
          icon: "🎯",
          desc: "Set a yearly target (e.g. 25 books). Watch your live progress bar update as you finish books, with a remaining-books countdown.",
          flag: "reading_goals",
        },
        {
          title: "Reading Velocity & Finish Date Forecasts",
          icon: "⚡",
          desc: "Track your current and total pages. NovelTribe calculates your average daily pace and forecasts estimated completion dates.",
          flag: "reading_velocity",
        },
        {
          title: "Session History Timeline",
          icon: "⏱️",
          desc: "View a chronological log on each book detailing every session, date, page milestone, and note.",
          flag: "show_session_timeline",
        },
        {
          title: "Gentle Reading Reminders",
          icon: "🔔",
          desc: "A quiet, dismissible banner reminding you to read if you haven't logged a session today, keeping your streak going.",
          flag: "reading_reminders",
        },
      ],
    },
    {
      category: "Kindle, Audiobooks & Multi-Format Reading",
      badge: "Format Versatility",
      color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30",
      description: "Seamlessly track reads across Kindle e-readers, audiobooks, and printed editions.",
      features: [
        {
          title: "Kindle & E-Book Matching",
          icon: "📱",
          desc: "Search books by Amazon ASIN (B0...) or ISBN-10/13. Imported Kindle books are automatically categorized and tagged.",
          flag: "Core & format_stats",
        },
        {
          title: "Audiobook Narrator & Duration Tracking",
          icon: "🎧",
          desc: "Track narrator names, audiobook runtimes (e.g. 11h 45m), and audio-specific notes for dedicated listeners.",
          flag: "audiobook_format",
        },
        {
          title: "Format Breakdown Analytics",
          icon: "📖",
          desc: "Categorize reads by Physical, E-Book, and Audiobook editions with aggregate format counts in your reading profile.",
          flag: "format_stats",
        },
        {
          title: "One-Click Amazon & Kindle Buying",
          icon: "🛒",
          desc: "Convenient compliant links on Want to Read books to purchase or borrow Kindle, Audible, or physical editions.",
          flag: "Core Platform",
        },
      ],
    },
    {
      category: "Book Cataloging, Shelves & Mood Tags",
      badge: "Flexible Organization",
      color: "from-violet-500/20 to-fuchsia-500/20 border-violet-500/30",
      description: "Customize your shelf beyond standard shelves. Keep the details that matter most to you.",
      features: [
        {
          title: "Mood & Vibe Tags",
          icon: "✨",
          desc: "Tag books with curated moods like Cozy, Dark, Fast-paced, Slow burn, Thought-provoking, Heartwarming, Tense, Atmospheric, and more.",
          flag: "mood_tags",
        },
        {
          title: "Custom Shelves & Instant Filtering",
          icon: "🏷️",
          desc: "Create arbitrary custom shelves (e.g. 'Favorites', 'DNF', 'Book Club', 'Re-read') with instant one-click filter buttons in your library.",
          flag: "custom_shelves",
        },
        {
          title: "Saved Quotes & Passages",
          icon: "💬",
          desc: "Save memorable quotes, page citations, and striking passages directly within your book's record.",
          flag: "quote_capture",
        },
        {
          title: "Ratings & Private 1,000-Char Reviews",
          icon: "⭐",
          desc: "Rate books 1 to 5 stars and record personal reflections on what stayed with you after finishing.",
          flag: "Core Platform",
        },
        {
          title: "Automated & Community Cover Artwork",
          icon: "🖼️",
          desc: "Automatic high-resolution cover lookup from Google Books and Open Library, with community cover approval by ISBN.",
          flag: "Core Platform",
        },
      ],
    },
    {
      category: "Discovery & Personalized Recommendations",
      badge: "Smart & Non-Commercial",
      color: "from-cyan-500/20 to-teal-500/20 border-cyan-500/30",
      description: "Discover books tailored to your unique taste, favorite genres, and mood vibes.",
      features: [
        {
          title: "Hybrid Recommendation Engine",
          icon: "🧭",
          desc: "Blends your finished book genres, highly rated titles, and preferred categories with catalog heuristics and AI discovery.",
          flag: "Core Platform",
        },
        {
          title: "Mood-Weighted Recommendations",
          icon: "🔮",
          desc: "When mood tags are enabled, the recommendation engine boosts candidate books that match the vibes you give 4- and 5-star ratings.",
          flag: "mood_tags",
        },
        {
          title: "Strict Peer Genre Matching",
          icon: "🤝",
          desc: "Only surface suggestions and followed reader activity from peers who read overlapping genres with you.",
          flag: "strict_peer_genre_match",
        },
        {
          title: "Recommendation Refresh & Dismissal",
          icon: "🔄",
          desc: "Bypass cache on demand for fresh title variations, or permanently dismiss titles with a private 'Not Interested' action.",
          flag: "Core Platform",
        },
        {
          title: "Quick Google Books & Open Library Search",
          icon: "🔍",
          desc: "Instant title and author lookup with cover artwork and metadata import in seconds.",
          flag: "Core Platform",
        },
      ],
    },
    {
      category: "Community, Follows & Circle Reviews",
      badge: "Opt-In & Controlled",
      color: "from-pink-500/20 to-rose-500/20 border-pink-500/30",
      description: "Connect with fellow readers and share your reading journey on your terms.",
      features: [
        {
          title: "Opt-in Public Reader Profiles",
          icon: "👤",
          desc: "Optional public reader card at novel-tribe.com/u/[username] showcasing verified reader badge, favorite genres, and shared reads.",
          flag: "Social Opt-In",
        },
        {
          title: "Granular Shelf Privacy Controls",
          icon: "🛡️",
          desc: "Independent owner toggles for showing public library, ratings, reviews, and activity. Hidden by default.",
          flag: "Privacy Core",
        },
        {
          title: "Follow & Unfollow Readers",
          icon: "👥",
          desc: "Follow other readers to see their public activity and reviews, with in-app follow notifications and one-click unfollowing.",
          flag: "Social Opt-In",
        },
        {
          title: "From Your Circle Review Shelf",
          icon: "📚",
          desc: "Dedicated feed on the recommendations page displaying top-rated reviews written by readers in your circle.",
          flag: "Social Opt-In",
        },
      ],
    },
    {
      category: "Privacy, Data Ownership & Badges",
      badge: "Reader First",
      color: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
      description: "Your reading data belongs strictly to you. No unwanted public feeds or lock-in.",
      features: [
        {
          title: "Private by Default",
          icon: "🔒",
          desc: "Your library, reviews, sessions, and activity are protected by Row-Level Security and private to your account.",
          flag: "Privacy Core",
        },
        {
          title: "Reading Milestones & Badges",
          icon: "🏆",
          desc: "11 private milestone achievements (Century Club, Habit Master, Genre Explorer, Bibliophile) tracked on your profile.",
          flag: "milestones",
        },
        {
          title: "Goodreads & Libby Library Import",
          icon: "📤",
          desc: "Import Goodreads CSVs or Libby/OverDrive tag spreadsheets with ISBNs, dates, formats, tags, Kindle detection, and duplicate-safe syncing.",
          flag: "Data Ownership",
        },
        {
          title: "One-Click CSV & JSON Export",
          icon: "📥",
          desc: "Download your entire library anytime in spreadsheet-friendly CSV format or complete JSON backup.",
          flag: "Data Ownership",
        },
        {
          title: "Dashboard Minimalism Mode",
          icon: "🌿",
          desc: "Toggle off large stat widgets in profile settings for a clean, quiet reading shelf with zero distractions.",
          flag: "show_stats_widgets",
        },
        {
          title: "Mobile PWA App",
          icon: "📲",
          desc: "Install NovelTribe directly to your iPhone or Android home screen as a standalone, fullscreen web app.",
          flag: "PWA",
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-6 lg:px-8">
        <header className="mb-12 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-sm md:flex-row md:items-center md:justify-between md:rounded-full">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-violet-500/30">
              <Image src="/icon.png" alt="NovelTribe" fill sizes="44px" className="object-cover" />
            </div>
            <a href="/" className="text-sm font-semibold tracking-[0.22em] text-violet-200 uppercase">
              NovelTribe
            </a>
          </div>

          <nav className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-zinc-300 md:w-auto md:flex-nowrap md:gap-5">
            <a href="/" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">
              Tracker
            </a>
            <a href="/reading" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">
              Reading
            </a>
            <a href="/recommendations" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">
              Recommendations
            </a>
            <a href="/features" className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 whitespace-nowrap text-cyan-100">
              Features
            </a>
            <a href="/getting-started" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">
              Getting started
            </a>
            <a href="/updates" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">
              Updates
            </a>
            <a href="/faq" className="rounded-full px-2 py-1 whitespace-nowrap transition hover:bg-white/5 hover:text-white">
              FAQ
            </a>
            <a href="/profile" className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 whitespace-nowrap text-violet-100 transition hover:bg-violet-500/15 hover:text-white">
              Profile
            </a>
          </nav>
        </header>

        <section className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
            Platform Guide
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
            Everything NovelTribe can do.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 md:text-lg">
            Built for passionate readers. NovelTribe stays simple by default, with powerful opt-in features you can toggle on or off in your profile at any time.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/#tracker"
              className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-6 py-2.5 text-sm font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110"
            >
              Open Your Tracker →
            </a>
            <a
              href="/profile"
              className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Configure Feature Flags
            </a>
          </div>
        </section>

        <div className="space-y-12">
          {featureCategories.map((cat) => (
            <section
              key={cat.category}
              className={`rounded-[32px] border bg-gradient-to-br ${cat.color} p-6 sm:p-8`}
            >
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-200">
                    {cat.badge}
                  </div>
                  <h2 className="text-2xl font-bold text-white sm:text-3xl">{cat.category}</h2>
                  <p className="mt-1 text-sm text-zinc-300">{cat.description}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cat.features.map((feat) => (
                  <div
                    key={feat.title}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0b1120]/90 p-5 shadow-lg backdrop-blur-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-3xl">{feat.icon}</span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                          {feat.flag}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white">{feat.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-16 rounded-[32px] border border-white/10 bg-gradient-to-r from-violet-500/10 via-[#111827] to-cyan-500/10 p-8 text-center sm:p-12">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to customize your reading experience?</h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-300 text-sm sm:text-base">
            Every feature on this page can be toggled in your profile settings. Keep your tracker minimal, or activate reading streaks, pace estimators, and custom shelves.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="/profile"
              className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-6 py-3 font-semibold text-[#20130d] shadow-lg shadow-amber-900/25 transition hover:brightness-110"
            >
              Go to Profile Toggles
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
