# NovelTribe Project Handoff

## Purpose

NovelTribe is a free, private-first reading tracker for people who want to organize their books, record reading progress, discover their next reads, and eventually participate in a reading community.

The product is funded through clearly disclosed Amazon affiliate links attached to book recommendations. Growth matters: the site should make it easy for readers to discover the product and share the canonical site URL, `https://novel-tribe.com`.

The current product is a functioning private beta. User libraries, profiles, reviews, activity, and recommendations are private to the signed-in user unless a future social feature explicitly introduces controlled public visibility.

## Current Stack

- Next.js `16.3.5`, App Router
- React `19.2.8`
- TypeScript `5`
- Tailwind CSS v4 through PostCSS
- Supabase Auth, PostgreSQL, Storage, and Row-Level Security
- OpenAI recommendations when `OPENAI_API_KEY` is available
- Google Books search/import and category metadata
- Open Library recommendation fallback
- Vercel hosting connected to GitHub
- Google Analytics 4 measurement ID `G-213KRMC0KT`
- Amazon Associate links using `NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG`

## Repository And Deployment

- GitHub repository: `https://github.com/kblume427/NovelTribe.git`
- Main branch: `master`
- Canonical production domain: `https://novel-tribe.com`
- Hosting: Vercel, deployed from GitHub `master`
- Latest pushed commit: `a33ac6e` (`Update Features page to include Kindle support, community follows, and full feature set`)
- The repository is kept clean and synchronized with `origin/master`.

### Environment Variables

Required in local development and Vercel as appropriate:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
GOOGLE_BOOKS_API_KEY=...
NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG=...
```

Rules:

- Never commit secrets.
- Never put private keys in `NEXT_PUBLIC_*` variables.
- The Google Books key previously exposed in chat must be revoked; use a newly generated, restricted key.
- Restrict the Google key to the Books API and the correct Google Cloud project.
- Vercel environment variable changes require a redeploy.
- Google Books previously returned HTTP 429 with quota value `0`; verify that the Vercel key belongs to the same Google Cloud project where Books API is enabled and quota is configured.

## Main Routes

- `/` - private reading tracker, add/edit/delete library, Google Books quick import, library search/sort, sharing section
- `/login` - Supabase magic-link login
- `/profile` - private profile, avatar upload, preferred categories, private activity timeline
- `/reading` - dedicated Currently Reading view
- `/reading` is intentionally read-only; book editing remains on the Tracker page
- `/recommendations` - recommendation page with `For You` and category filters
- `/about` - public crawlable product description
- `/features` - comprehensive platform feature guide explaining all core and opt-in toggles
- `/auth/callback` - Supabase magic-link callback
- `/u/[username]` - opt-in public reader card with favorite genres, reading history teaser, dynamic SEO/OG, and join CTA
- `/api/books` - authenticated user-scoped book CRUD
- `/api/books/search` - Google Books proxy with ISBN normalization
- `/api/recommend` - OpenAI, Google Books, Open Library, and local fallback recommendation engine
- `/api/sessions` - authenticated user-scoped reading sessions CRUD and daily streak calculator
- `/robots.txt` and `/sitemap.xml` - generated SEO routes
- `/opengraph-image` - generated 1200x630 social preview image

## Completed Product Features

### Opt-In Feature Toggles & Single Store

- Single source of truth in `lib/featureFlags.ts` storing feature preferences as JSONB on `profiles.feature_flags`.
- Privacy-first: all optional features are disabled by default until the reader explicitly opts in.
- UI toggles organized cleanly in `/profile` under four sections:
  1. Discovery & recommendations
  2. Reading habit tracking
  3. Book entry extras
  4. Dashboard display

### Reading Habits, Sessions & Streaks

- Dedicated `reading_sessions` table with user-scoped Row-Level Security.
- Quick session logger directly on `/reading` to record minutes read, pages turned, and optional session notes.
- Consecutive-day streak calculation algorithm (`lib/sessions.ts`) with live streak badges displayed across Currently Reading, Tracker hero, and Profile.
- Expandable chronological session history timeline on each book.
- Gentle reading reminder banner on `/` when no session has been logged today, encouraging daily habits.

### Reading Goals & Velocity Estimator

- Annual reading goal input in `/profile` with live progress bars and remaining-books countdowns on Profile and Dashboard.
- Book page tracking (`books.total_pages` and `books.current_page`).
- Daily pace calculation and dynamic finish date forecasting (`lib/velocity.ts`) displaying `~X days to finish (Date)` and percentage complete.
- Inline page-update controls on Currently Reading cards.

### Book Cataloging Extras

- **Mood & Vibe Tags**: Controlled vocabulary (`MOOD_TAGS`) with chip multi-select in book entry; rendered in library list; boosts recommendations matching 4- and 5-star vibes.
- **Custom Shelves**: User-created tags (e.g. *Favorites*, *DNF*, *Book Club*, *Re-read*) with instant filter bar above library list.
- **Quote Capture**: Interactive quote entry and deletion; rendered as formatted blockquote cards in library.
- **Format Tracking**: Physical, E-Book, and Audiobook selector with aggregate format breakdown cards on Profile.
- **Audiobook Support**: Narrator name and duration/runtime tracking with contextual inputs and library badges.

### Milestones & Achievements

- Badge evaluation engine (`lib/milestones.ts`) with 11 private achievements (*First Step*, *Reviewer*, *Found a Gem*, *Page Turner*, *Bibliophile*, *Genre Explorer*, *Daily Reader*, *Habit Master*, *Format Flexible*, *Quote Collector*, *Goal Crusher*).
- Showcase cards in Profile and Tracker dashboard highlighting unlocked badges and tracking locked progress.

### Data Ownership & Mobile App (PWA)

- **One-Click Export**: Full library backup to CSV or JSON format from Profile.
- **Goodreads CSV Import**: High-fidelity parser (`lib/importExport.ts`) reading `goodreads_library_export.csv` with automated shelf, status, rating, review, and finish date mapping.
- **Protected Read-Book Clearing**: Profile data-ownership controls require typing `DELETE` before permanently removing books marked `Read`; active and planned books remain.
- **PWA / Mobile Home Screen**: Web App Manifest (`manifest.webmanifest`), apple-web-app configuration, and mobile viewport optimizations for standalone native-like installation.

### Social & Peer Matching

- **Strict Peer Genre Matching**: Filtered reader recommendations and peer-influenced "For You" recommendations ensuring followed users only shape suggestions when favorite genres overlap.

### Platform Documentation

- Public `/features` guide route detailing all core and toggleable capabilities with direct CTAs.

### Accounts And Persistence

- Supabase magic-link authentication
- Auth callback and proxy session refresh (migrated from deprecated middleware to `proxy.ts`)
- Per-user book storage protected by RLS
- User-scoped API reads and writes
- Profile records with name, username, avatar, and preferred categories

### Library

- Add, edit, and delete books
- Statuses: `Read`, `Currently Reading`, `Want to Read`
- Ratings from 1 to 5
- Completion timestamp `finished_at`
- ISBN persistence and display
- Short private reviews, limited to 1,000 characters
- Multiple categories stored in `books.categories` while retaining a primary `genre`
- Search by title, author, ISBN, category, and review text
- Sort by newest added, title, rating, and recently finished
- Sort by status with Want to Read and Currently Reading books first
- Mobile layout fixes for navigation, quick import, and edit/save flows

### Google Books And Metadata

- Quick import through a server-side proxy
- ISBN-10 and ISBN-13 detection, including hyphens, spaces, `ISBN` prefixes, and ISBN-10 `X`
- Preserves all Google Books categories instead of silently defaulting to Fantasy
- Imported categories become available to the user as separate filters
- New imports use the Google category list as the book's category array

### Recommendations

- Dedicated `/recommendations` page
- `For You` mode and exact category filters
- Existing user titles excluded from results
- Case/punctuation-tolerant title matching
- Category-neutral For You results with diversified categories
- Profile category preferences included in scoring
- Read-category frequency included in scoring
- 4-5 star read-category counts receive extra weight
- OpenAI provider when configured
- Google Books fallback
- Open Library fallback with no additional key
- Local curated fallback catalog
- Provider timeouts and five-minute in-memory category cache
- Provider source returned as `openai`, `google_books_open_library`, or `local_fallback`
- Refresh suggestions rotates provider result windows, varies AI generation, and rotates local fallback ordering
- For You incorporates high-rated categories from followed users who make their library and ratings public
- Matching recommendation cards identify the followed-reader high-rating signal
- Recommendation cards show Google Books or Open Library cover art when available, with a visual fallback otherwise
- External category recommendations require matching source metadata to avoid mislabeled or unrelated cards
- Quick Add searches run only on Search/Enter, cache results for ten minutes, and fall back to Open Library when Google Books is quota-limited
- Missing recommendation covers are enriched from Open Library using title/author lookup with in-process caching
- Production Supabase auth cookies use explicit secure, lax, canonical-domain attributes for Safari persistence
- Login page includes Apple/Safari guidance to keep magic-link requests and callbacks in the same browser context
- Private admin-only total user count available through `/api/admin/user-count` for allowlisted usernames
- Recommendation cards preserve the full cover image with `object-contain` instead of cropping it
- Recommendation cards can add a title directly to the library as Read or Want to Read
- Want to Read library cards include a disclosed Amazon affiliate purchase link
- Users can permanently dismiss recommendation titles with a private Not Interested action
- Quick Add stores immutable Google Books cover URLs for library and Currently Reading display
- Manual book entry looks up and previews an official Google Books cover when a title/author match is found
- Manual cover previews require explicit Use/Skip approval; approved covers are shared by ISBN through `cover_approvals`
- Library offers a conditional Find missing covers workflow with per-book approval

### Private Activity And Reviews

- Append-only private activity events for started, finished, and rated actions
- Latest 12 activity events shown on profile
- RLS limits activity reads/inserts to the signed-in user
- Reviews are private book fields for now
- Public social feed, public reviews, and public libraries are intentionally not implemented

### Social Phase 2: Follows

- Follow/unfollow API at `/api/follows`
- Follow button on opt-in public profiles
- Recommended public readers section on `/recommendations`, excluding the current user and existing follows
- Private Followers/Following lists on the profile page
- Follow relationship reads allow both followers and followed users to see their own connection lists
- In-app follow notifications with unread state and mark-all-read
- Profile social inbox kept below the navigation header with responsive mobile layout
- Followers and Following lists use a compact scrollable panel sized for roughly 10 visible rows
- Privacy-controlled activity feed on `/recommendations` for followed users who enable public activity
- From your circle review shelf showing followed users' public reviewed books ordered by rating
- Public reviews are independently visible from the public library setting through a dedicated RLS policy
- Activity feed items carry and display the book cover URL when available
- Private-profile and self-follow protections
- User-scoped follows RLS policies
- GA4 events for `user_followed` and `user_unfollowed`
- Run the `follows` migration in Supabase before testing

### Growth, Analytics, And SEO

- Homepage share section with native share sheet or copy fallback
- Shares use canonical URL `https://novel-tribe.com`
- GA4 page tracking with measurement ID `G-213KRMC0KT`
- Comprehensive product telemetry with privacy-safe parameters (no email addresses, review text, or private identifiers):
  - **Auth & Lifecycle**: `sign_in_started`, `sign_in_completed`, `user_signed_out`
  - **Library Management**: `book_added` (manual / recommendation), `book_status_changed`, `book_finished`, `book_rated`, `review_saved`, `book_edit_opened`, `book_deleted`
  - **Library Navigation**: `library_sorted`, `shelf_filter_selected`, `quick_import_searched`
  - **Cover Art Pipeline**: `missing_covers_searched`, `missing_cover_approved`, `missing_covers_approved_all`
  - **Data Ownership**: `library_exported` (CSV/JSON), `library_import_started`, `library_imported` (breakdown of inserted, updated, unchanged), `read_books_cleared`, `book_imported` (Google Books)
  - **Habits & Goals**: `reading_session_logged`, `reading_progress_updated`, `reading_goal_updated`, `reminder_clicked`, `reminder_dismissed`, `currently_reading_viewed`
  - **Settings & Preferences**: `profile_updated`, `avatar_uploaded`, `feature_flag_toggled`
  - **Recommendations & Affiliate**: `recommendations_viewed`, `recommendation_source_used`, `recommendation_filter_selected`, `recommendations_refresh_clicked`, `recommendation_dismissed`, `affiliate_link_clicked`, `recommendation_clicked`
  - **Community & Social**: `user_followed`, `user_unfollowed`, `recommended_reader_clicked`, `social_tab_changed`, `notifications_marked_read`, `circle_review_expanded`
  - **Sharing**: `share_clicked`, `share_completed`, `share_link_copied`
- Amazon affiliate links with disclosure
- Canonical URL metadata
- Page titles, descriptions, keywords, Open Graph, and Twitter metadata
- JSON-LD for WebSite, SoftwareApplication, and Organization
- Generated robots and sitemap routes
- Login/profile excluded from indexing
- Public About page
- Generated social preview image

## Database And Supabase Setup

The source of truth for schema and RLS is `supabase-schema.sql`. Run migrations in Supabase SQL Editor before testing new features. Important current columns/tables include:

- `profiles.preferred_categories text[]`
- `profiles.is_public boolean`
- `profiles.public_library boolean`
- `profiles.public_ratings boolean`
- `profiles.public_reviews boolean`
- `books.finished_at timestamp with time zone`
- `books.isbn text`
- `books.categories text[]`
- `books.review text`
- `reading_activity`
- `storage.buckets.avatars`
- User-scoped profile, book, activity, and avatar Storage policies

For an existing production database, the safest incremental migrations are:

```sql
alter table profiles
add column if not exists preferred_categories text[] default '{}';

alter table profiles
add column if not exists is_public boolean default false;

alter table profiles
add column if not exists public_library boolean default false;

alter table profiles
add column if not exists public_ratings boolean default false;

alter table profiles
add column if not exists public_reviews boolean default false;

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table follows enable row level security;

create policy "Users can view their own follows"
on follows for select
using (auth.uid() = follower_id);

create policy "Users can create their own follows"
on follows for insert
with check (auth.uid() = follower_id);

create policy "Users can delete their own follows"
on follows for delete
using (auth.uid() = follower_id);

create policy "Anyone can view public profiles"
on profiles for select
using (is_public = true);

drop policy if exists "Anyone can view public library books" on books;

create policy "Anyone can view public library books"
on books for select
using (
  exists (
    select 1 from profiles
    where profiles.id = books.user_id
      and profiles.is_public = true
      and profiles.public_library = true
  )
);

alter table books
add column if not exists finished_at timestamp with time zone;

alter table books
add column if not exists isbn text;

alter table books
add column if not exists categories text[] default '{}';

alter table books
add column if not exists review text;

-- Optional feature flags, reading goals, and book extensions
alter table profiles
add column if not exists feature_flags jsonb not null default '{}'::jsonb;

alter table profiles
add column if not exists reading_goal integer default null;

alter table books
add column if not exists mood_tags text[] default '{}',
add column if not exists quotes text[] default '{}',
add column if not exists format text default null,
add column if not exists audiobook_narrator text default null,
add column if not exists audiobook_duration text default null,
add column if not exists custom_shelves text[] default '{}',
add column if not exists total_pages integer default null,
add column if not exists current_page integer default null;

-- Reading sessions table
create table if not exists reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  pages_read integer check (pages_read is null or pages_read >= 0),
  notes text,
  session_date date not null default current_date,
  created_at timestamp with time zone default now()
);

create index if not exists reading_sessions_user_date_idx on reading_sessions(user_id, session_date desc);
create index if not exists reading_sessions_book_idx on reading_sessions(book_id);

alter table reading_sessions enable row level security;

create policy "Users can view their own reading sessions"
on reading_sessions for select
using (auth.uid() = user_id);

create policy "Users can insert their own reading sessions"
on reading_sessions for insert
with check (auth.uid() = user_id);

create policy "Users can update their own reading sessions"
on reading_sessions for update
using (auth.uid() = user_id);

create policy "Users can delete their own reading sessions"
on reading_sessions for delete
using (auth.uid() = user_id);
```

The activity table and avatar policies are also present in `supabase-schema.sql`. If a full schema rerun stops on an already-existing policy, run the relevant migration block separately. Avatar uploads require the `avatars` bucket plus the `storage.objects` policies.

## Recently Completed & Shipped Changes

### Phase 0 & Phase 1: Feature Architecture & Full Backlog Implementation (Commits `8a851e4`, `3ba36ee`, `8ea396a`, `0cd468c`)

1. **Opt-in Feature Flags Architecture**:
   - Single JSONB store (`profiles.feature_flags`) avoiding schema migration churn.
   - Comprehensive toggle center on `/profile` divided into 4 intuitive categories.
   - All optional features disabled by default for privacy and clutter-free usage.

2. **Habits, Goals & Velocity**:
   - `reading_sessions` table with user-scoped CRUD and daily streak calculator.
   - Quick session logger and expandable session history timeline on `/reading`.
   - Annual reading goal progress bars and remaining-books countdown.
   - Daily reading pace calculator and estimated finish date forecasts (`lib/velocity.ts`).
   - Gentle reading habit reminder banner on `/` when no session has been recorded today.

3. **Book Cataloging & Customization**:
   - Mood & vibe tag chip selector (`MOOD_TAGS`), library badge display, and recommendation weighting.
   - Custom shelves tagging and dynamic shelf filter bar in library.
   - Multi-quote capture and blockquote rendering.
   - Format breakdown (Physical, E-Book, Audio) and audiobook narrator/runtime tracking.

4. **Milestones, Data Ownership & PWA**:
   - 11 badge achievements evaluated in `lib/milestones.ts` displayed on Profile and Dashboard.
   - One-click CSV and JSON library export.
   - High-fidelity Goodreads CSV export parser (`lib/importExport.ts`) with automated shelf/status/rating/review mapping.
   - PWA web app manifest and iOS fullscreen standalone configuration.
   - Strict peer genre matching for reader recommendations and circle discovery.

5. **Platform Guide Route**:
   - Public `/features` page showcasing all platform capabilities with direct CTAs.
   - Header navigation and sitemap integration across the entire application.

The SEO enhancements and initial handoff documentation were verified, committed, and pushed to `master` in commits `c1028b5` and `ee35c55`:

- Structured data (JSON-LD for WebSite, SoftwareApplication, and Organization) added in `app/layout.tsx`
- Crawl disallow rules updated in `app/robots.ts` for `/api/`, `/auth/`, `/login`, and `/profile`
- Public `/about` route created (`app/about/page.tsx`) with product overview, features, privacy guarantee, and canonical sharing
- Sitemap (`app/sitemap.ts`) updated with priority and change frequencies including `/about`
- Dedicated page layouts with titles and descriptions added for `/reading` and `/recommendations`
- Generated social preview image added via `app/opengraph-image.tsx`
- Project handoff documentation created and committed to the repository

### Library Import Upsert & Smart Deduplication
- **Deduplication Strategy**: Added intelligent upsert support in `/api/books` for library imports. Matches incoming records against existing library entries by clean ISBN (primary) and case-insensitive Title + Author (secondary).
- **Non-Destructive Attribute Merging**: Preserves existing user data while backfilling missing fields (e.g., status changes to `Read`, missing ratings, reviews, format, page counts) and merging `mood_tags`, `custom_shelves`, and `quotes` with `Set` deduplication.
- **Granular Import Feedback**: Profile import UI (`/profile`) now reports detailed import metrics: added new, updated existing, and already up to date.
- **Multi-Genre Books**: Books retain a primary `genre` plus multiple `categories`; Goodreads genre/category metadata and catalog fallback classification are normalized into the supported genre vocabulary.
- **Goodreads Genre Correction**: Imports use all available catalog categories, recognize common Goodreads/Google Books/Open Library genre labels, and correct existing `General Fiction` records during re-import when better metadata is found.
- **Goodreads-First Classification**: Explicit genre/category values in a Goodreads CSV are authoritative; Google Books and Open Library are queried only when the CSV does not provide genre data.
- **Genre Normalization Map**: Raw Goodreads and catalog labels are normalized through a keyword map into the existing UI genres; generic labels such as `Fiction` are ignored rather than treated as useful classifications.
- **Standard Goodreads Export Fallback**: Standard Goodreads exports may contain no genre column, as in the supplied library export; ISBN-based catalog enrichment therefore uses expanded Open Library subject metadata and the normalization map for classification.
- **Manual Imported-Book Genre Editing**: The tracker’s primary genre field is directly editable for imported books, with suggestions from the existing genre vocabulary and multi-category preservation on save.
- **Complete Imported-Book Editing**: Goodreads-imported titles, authors, ISBNs, genres/categories, status, ratings, reviews, finish dates, formats, and custom shelves can be edited and saved from the Tracker.
- **Goodreads Import Alert**: Tracker and Profile show a dismissible import-repair notice that automatically expires at September 17, 2026, 12:00 AM CST.
- **Cross-Platform Auth Persistence**: Magic-link callbacks preserve the requesting host and Supabase auth cookies remain host-scoped, preventing session and public-profile auth drops across Safari PWA, desktop browsers, and preview domains.
- **ISBN-First Affiliate Links**: Amazon links use a cleaned ISBN or ASIN search when available, with title/author search retained only as a fallback for books without identifiers.
- **Getting Started Onboarding**: Added public `/getting-started` guidance covering first steps, profile setup, privacy controls, optional feature toggles, Goodreads CSV import, ISBN-based classification, safe re-imports, and editing imported books.
- **Weighted Top Genre**: Profile statistics count every distinct category attached to each book when determining the reader's top genre, with primary-genre fallback for legacy records.

### Quick Import Search & ASIN / Kindle Support
- **Bibliographic Search Query**: Quick import input on the tracker page supports Title, Author, and ISBN-10/13 through Google Books and Open Library. Helper text clarifies that Amazon `B0...` Kindle ASINs (which are proprietary to Amazon and absent from open bibliographic databases) are auto-detected and imported with their full title/author metadata during Goodreads CSV import.

### High-Resolution Cover Art & Auto-Resolution Pipeline
- **Dedicated Cover Resolution Engine (`lib/covers.ts`)**: Created a waterfall resolver combining Open Library Direct ISBN CDN (`-L.jpg`), Open Library work/author search, and Google Books volumes fallback.
- **Image URL Sanitization**: Enforces HTTPS, removes curl/border distortions, and upgrades low-res `-M.jpg` thumbnails to high-res `-L.jpg` format across all search, recommendation, and catalog routes.
- **Automated Import Cover Enrichment**: When books are added or imported from Goodreads CSVs without cover URLs, `/api/books` automatically resolves high-res covers in the background.
- **Batch Missing Cover Resolution**: Enhanced the "Find missing covers" workflow on the tracker dashboard with direct ISBN detection, grid preview, and one-click "Approve all" batch saving.

### Recommendations Reliability & UX Polish

- **Refresh suggestions action**: Added a button on `/recommendations` allowing readers to bypass cached recommendations and fetch fresh suggestions on demand.
- **Provider & source badge**: Displayed provider source badge (`Curated by AI`, `Google Books & Open Library`, or `Curated Catalog`) so users can see how recommendations were generated.
- **Last-updated timestamp**: Added a human-readable timestamp showing when the current shelf was last fetched.
- **Error retry UX**: Added graceful error and empty-state messaging with a dedicated "Try Again" / "Try refreshing" trigger.
- **API cache bypass support**: Updated `/api/recommend` route to accept `{ refresh: boolean }`, allowing Google Books and Open Library fetch requests to bypass in-memory caching when requested.
- **Analytics enhancement**: Included `refreshed` flag in `recommendations_viewed` and `recommendation_source_used` analytics events.

### Social Phase 1: Public Profile Opt-in & Reader Page (`/u/[username]`)

- **Opt-in privacy model**: Added `is_public` boolean column to `profiles` (default: `false`) and created RLS policy `"Anyone can view public profiles"` allowing public access only when `is_public = true`.
- **Canonical Domain Enforcement (`https://novel-tribe.com`)**:
  - Handled domain redirection gracefully at the Vercel dashboard level to prevent any server-level loop between `www` and root apex domains.
  - Configured auth callbacks and magic links in `app/login/page.tsx` and `app/auth/callback/route.ts` to redirect back to `https://novel-tribe.com` in production rather than raw Vercel domains.
  - Verified all public sharing, SEO metadata, sitemaps, robots, JSON-LD, and copy-link triggers strictly resolve to `https://novel-tribe.com`.
- **Public Reader Profile (`/u/[username]`)**: Implemented dynamic public reader profile page showing avatar, display name, username, join year, verified reader badge, favorite categories/genres, and viral "Join NovelTribe" signup CTA.
- **Dynamic SEO & OpenGraph**: Added rich metadata generation for `/u/[username]` including canonical URLs, OpenGraph profile cards, and Twitter summary cards.
- **Custom Not Found page**: Added `app/not-found.tsx` to handle private/non-existent profiles and missing routes with quick return navigation.
- **Public shelf privacy controls**: Added independent owner controls for showing the public library, ratings, and private reviews. Public book rows are protected by an RLS policy requiring both a public profile and an explicitly shared library.
- **Public shelf rendering**: Public profiles can now show shared books, categories, statuses, finished counts, and only the ratings/reviews explicitly enabled by the owner.
- **Following foundation**: Added opt-in follow/unfollow relationships for public profiles, protected by user-scoped RLS and exposed through `/api/follows`.

## Recommended Next To-Do List & Status Audit

### Immediate Release & Production Verification
- [x] Verify Vercel deployment of the latest commit (`master`).
- [x] Run all current Supabase migrations in production (all SQL migrations executed).
- [x] Verify public routes (`/about`, `/features`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image`) and metadata on `https://novel-tribe.com`.
- [x] Verify public shelf privacy migration and test visibility combinations on `/u/[username]`.
- [x] Verify "Refresh suggestions" button and provider indicator on `/recommendations`.
- [x] Migrate deprecated Next.js `middleware.ts` to `proxy.ts`.
- [x] Confirm GA4 Realtime events after deployment (`G-213KRMC0KT`).
- [x] Maintain secure environment variables in Vercel.

### Reading Workflow (Completed in Full)
- [x] **Reading goals and progress tracking**: Annual goal setter with live progress bars and countdown in profile and tracker.
- [x] **Monthly/yearly reading totals & format breakdown**: Physical, E-Book, and Audio breakdown counters on profile.
- [x] **Completion streaks & sessions**: `reading_sessions` table with quick logger and daily streak counter (`🔥 X days`).
- [x] **Session timeline**: Expandable chronological reading log on each book.
- [x] **Reading velocity & finish date forecasts**: Page tracking engine (`lib/velocity.ts`) estimating completion dates.
- [x] **Mood & vibe tags**: Tag selector (`MOOD_TAGS`), library badge display, and recommendation weighting.
- [x] **Custom shelves**: Arbitrary tagging (Favorites, DNF, Book Club, etc.) and filter bar in library.
- [x] **Quote capture**: Multi-quote entry and blockquote formatting in library.
- [x] **Audiobook support**: Narrator and runtime tracking.
- [x] **Private reading milestones**: 11 badge achievements evaluated in `lib/milestones.ts` on profile and dashboard.
- [x] **Reading reminders**: Dismissible daily streak habit reminder banner on tracker.
- [x] **Data ownership**: One-click CSV and JSON library export plus Goodreads CSV import parser (`lib/importExport.ts`).
- [x] **Smart Library Upsert & Deduplication**: Intelligent matching by ISBN and Title+Author during import to update records rather than creating duplicates.
- [x] **PWA / Mobile App**: Standalone fullscreen mobile configuration and web manifest.

### Growth & Platform Polish (Completed in Full)
- [x] Public, crawlable platform guide page at `/features` explaining all core and opt-in capabilities.
- [x] Public product overview at `/about`.
- [x] Canonical domain redirection and SEO sitemap updated with `/features`.
- [x] Social preview testing via `/opengraph-image`.
- [x] Strict peer genre matching for reader recommendations and circle discovery.

---

## Remaining Work & Future Roadmap

The core application, privacy controls, social follows, reading habits, and full opt-in feature set are complete. Future post-launch roadmap candidates include:

### Future Social Enhancements (Opt-In Only)
- [ ] Community likes & reactions on public activity items
- [ ] Spoiler masking/tagging on public book reviews
- [ ] User blocking and muting controls
- [ ] Content reporting and moderation queue

### Future Reliability & Advanced Utilities
- [ ] Move in-memory recommendation cache to shared Redis/Upstash if horizontal scaling requires it
- [ ] Duplicate-book detection and merge utility for large library imports
- [ ] Additional category landing pages once user-generated public content grows
- [ ] Submit sitemap to Google Search Console for production tracking

### Product Experience & Onboarding
- [x] Fix genre classification on Goodreads imports, including reliable fallback and category normalization.
- [x] Allow editing all information on Goodreads-imported books, including manual and automatic genre adjustments.
- [x] Add an onboarding getting-started, welcome, and how-to page covering first steps and library import guidance.
- [ ] Optimize landing page calls to action with benefit-driven text and clearer conversion paths.
- [ ] Add a public updates or changelog page for shipped product improvements.
- [ ] Add a dedicated FAQ page covering privacy, imports, recommendations, accounts, and common workflows.
- [ ] Add a bug report and feedback mechanism with privacy-conscious submission handling.
- [ ] Make visual changes that give the product a warmer, more inviting "curl up with a good book" feeling.

### Search, Commerce & Privacy
- [x] Update affiliate links to search and link by book ISBN instead of title and author name when an ISBN is available.
- [ ] Add user search with explicit privacy and opt-in controls for discoverability.
- [x] Fix session persistence and public profile link authentication drops across iOS Safari PWA and other browsers.

## Handoff Update Rule

Every future code update must include a corresponding update to this document in the same change. Keep the following current:

- Latest pushed commit and repository state
- Completed features and recently shipped changes
- Database migrations and environment requirements
- Remaining work and known warnings
- Verification results and deployment notes

## Development Workflow

From the project directory:

```powershell
npm install
npm run dev
npm run build
npm run lint
```

Before committing:

1. Run `git diff --check`.
2. Run `npm run build`.
3. Inspect `git status --short`.
4. Commit only related changes.
5. Push `master` when requested.
6. Confirm `git status --short` is clean and `git branch -vv` matches `origin/master`.

## Guidance For Future AI Assistants

- Preserve user-scoped Supabase access and RLS.
- Do not expose emails, review text, or private profile data to Analytics.
- Do not make profile/library/activity public without explicit privacy design.
- Prefer existing local abstractions and the current App Router structure.
- Keep recommendation providers resilient; Google Books may quota-limit even when configured quotas look sufficient.
- Keep `For You` category-neutral and diversified. Named category filters should remain exact.
- Preserve Google Books categories individually in `categories[]`.
- Use the canonical sharing URL `https://novel-tribe.com`.
- Do not commit secrets, generated `.next` output, or unrelated user changes.
- Build before claiming a change is complete.
