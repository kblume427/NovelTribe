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
- Latest pushed commit before this feature: `f90fe64` (`Add public profile privacy controls`)
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
- `/recommendations` - recommendation page with `For You` and category filters
- `/about` - public crawlable product description
- `/auth/callback` - Supabase magic-link callback
- `/u/[username]` - opt-in public reader card with favorite genres, reading history teaser, dynamic SEO/OG, and join CTA
- `/api/books` - authenticated user-scoped book CRUD
- `/api/books/search` - Google Books proxy with ISBN normalization
- `/api/recommend` - OpenAI, Google Books, Open Library, and local fallback recommendation engine
- `/robots.txt` and `/sitemap.xml` - generated SEO routes
- `/opengraph-image` - generated 1200x630 social preview image

## Completed Product Features

### Accounts And Persistence

- Supabase magic-link authentication
- Auth callback and middleware session refresh
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
- Missing recommendation covers are enriched from Open Library using title/author lookup with in-process caching
- Production Supabase auth cookies use explicit secure, lax, canonical-domain attributes for Safari persistence
- Recommendation cards preserve the full cover image with `object-contain` instead of cropping it
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
- Activity feed items carry and display the book cover URL when available
- Private-profile and self-follow protections
- User-scoped follows RLS policies
- GA4 events for `user_followed` and `user_unfollowed`
- Run the `follows` migration in Supabase before testing

### Growth, Analytics, And SEO

- Homepage share section with native share sheet or copy fallback
- Shares use canonical URL `https://novel-tribe.com`
- GA4 page tracking with measurement ID `G-213KRMC0KT`
- Product events for sign-in, book lifecycle, import, ratings, reviews, avatars, recommendations, provider source, sharing, currently-reading views, and affiliate clicks
- No email addresses or review text sent to Analytics
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
```

The activity table and avatar policies are also present in `supabase-schema.sql`. If a full schema rerun stops on an already-existing policy, run the relevant migration block separately. Avatar uploads require the `avatars` bucket plus the `storage.objects` policies.

## Recently Completed & Shipped Changes

The SEO enhancements and initial handoff documentation were verified, committed, and pushed to `master` in commits `c1028b5` and `ee35c55`:

- Structured data (JSON-LD for WebSite, SoftwareApplication, and Organization) added in `app/layout.tsx`
- Crawl disallow rules updated in `app/robots.ts` for `/api/`, `/auth/`, `/login`, and `/profile`
- Public `/about` route created (`app/about/page.tsx`) with product overview, features, privacy guarantee, and canonical sharing
- Sitemap (`app/sitemap.ts`) updated with priority and change frequencies including `/about`
- Dedicated page layouts with titles and descriptions added for `/reading` and `/recommendations`
- Generated social preview image added via `app/opengraph-image.tsx`
- Project handoff documentation created and committed to the repository

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

## Recommended Next To-Do List

### Immediate Release & Production Verification

- Verify Vercel deployment of the latest commit.
- Run all current Supabase migrations in production if not already completed.
- Verify the new public routes (`/about`, `/robots.txt`, `/sitemap.xml`, `/opengraph-image`) and metadata on `https://novel-tribe.com`.
- Run the public shelf privacy migration and test each visibility combination on `/u/[username]`.
- Verify the new "Refresh suggestions" button and provider indicator on `/recommendations`.
- Revoke any previously exposed Google API key and verify the replacement key in Vercel.
- Confirm Google Books quota and Books API project alignment.
- Confirm GA4 Realtime events after deployment.

### Product Reliability

- Move recommendation caching to a durable/shared cache if traffic grows beyond one Vercel instance.
- Add automated tests for title deduplication, category filtering, diversity, and provider fallback behavior.
- Consider rate limiting the recommendation API.

### Reading Workflow

- Reading goals and progress tracking
- Monthly/yearly reading totals
- Favorite category and author insights
- Completion streaks
- Rating trends
- Duplicate-book merge tools
- Better cover image handling
- Metadata correction/reporting

### Growth

- Add a public, crawlable "How it works" page
- Add category landing pages only when there is enough useful content
- Submit sitemap to Google Search Console
- Verify canonical-domain redirects for `www` and Vercel preview URLs
- Improve social preview testing after deployment
- Track conversion funnels in GA4: sign-in, first book, first finish, share, affiliate click
- Add email signup only after privacy/consent requirements are defined

### Social Phase, Later

Do not make private activity public without explicit privacy controls.

- Public profile opt-in
- Public library opt-in
- Public/private activity controls
- Following users
- Community feed
- Likes/reactions
- Public reviews
- Spoiler handling
- Reporting and moderation
- Block/mute controls

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

Known warning:

- Next.js 16 reports that the `middleware` file convention is deprecated and suggests migrating to `proxy`. This is currently a warning, not a build failure. Treat migration as a focused future maintenance task.

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
