import {
  allGenres,
  buildHeuristicRecommendations,
  diversifyRecommendations,
  getBookCategories,
  normalizeTitle,
  type BookRecord,
  type Recommendation,
} from "@/lib/recommendations";
import { normalizeImportedGenre } from "@/lib/importExport";
import { openai } from "@/lib/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureEnabled, resolveFeatureFlags } from "@/lib/featureFlags";
import { sanitizeCoverUrl } from "@/lib/covers";

const categoryCache = new Map<string, { expiresAt: number; recommendations: Recommendation[] }>();
const CATEGORY_CACHE_TTL = 5 * 60 * 1000;
const coverCache = new Map<string, string | null>();
const curatedGenres = new Set(allGenres);
const RESULT_LIMIT = 12;

function toCuratedGenre(category: string): string | null {
  if (curatedGenres.has(category)) return category;
  const normalized = normalizeImportedGenre([category]);
  return curatedGenres.has(normalized) ? normalized : null;
}

function matchesCategory(value: unknown, category: string) {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedCategory = category.toLowerCase();
  return normalizedValue.includes(normalizedCategory) || normalizedCategory.includes(normalizedValue);
}

async function enrichCovers(recommendations: Recommendation[]) {
  return Promise.all(recommendations.map(async (recommendation) => {
    if (recommendation.cover_url) return recommendation;

    const cacheKey = normalizeTitle(`${recommendation.title}-${recommendation.author}`);
    if (coverCache.has(cacheKey)) {
      return { ...recommendation, cover_url: coverCache.get(cacheKey) ?? null };
    }

    try {
      const url = new URL("https://openlibrary.org/search.json");
      url.searchParams.set("title", recommendation.title);
      url.searchParams.set("author", recommendation.author);
      url.searchParams.set("limit", "1");
      url.searchParams.set("fields", "cover_i,isbn");
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const payload = response.ok ? await response.json() : null;
      const doc = payload?.docs?.[0];
      let coverUrl: string | null = null;
      if (doc?.cover_i) {
        coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      } else if (doc?.isbn?.[0]) {
        coverUrl = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
      }
      coverCache.set(cacheKey, coverUrl);
      return { ...recommendation, cover_url: coverUrl };
    } catch {
      coverCache.set(cacheKey, null);
      return recommendation;
    }
  }));
}

async function getGoogleBookRecommendations(books: BookRecord[], category: string, bypassCache = false, offset = 0, newest = false) {
  const cacheKey = `google:${newest ? "newest" : "relevance"}:${category.toLowerCase()}`;
  const cached = categoryCache.get(cacheKey);
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
  }

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `subject:"${category}"`);
  url.searchParams.set("maxResults", "20");
  url.searchParams.set("startIndex", String(offset));
  url.searchParams.set("printType", "books");
  url.searchParams.set("orderBy", newest ? "newest" : "relevance");
  url.searchParams.set("langRestrict", "en");

  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const recommendations = (payload.items ?? [])
    .map((item: { id: string; volumeInfo?: { title?: string; authors?: string[]; categories?: string[]; imageLinks?: { thumbnail?: string; smallThumbnail?: string }; industryIdentifiers?: Array<{ identifier?: string }> } }) => {
      const title = item.volumeInfo?.title ?? "Untitled";
      const rawCover = item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail ?? null;
      return {
        id: item.id,
        title,
        author: item.volumeInfo?.authors?.join(", ") ?? "Unknown author",
        isbn: item.volumeInfo?.industryIdentifiers?.find((identifier) => identifier.identifier)?.identifier ?? null,
        genre: category,
        status: "Want to Read" as const,
        rating: 0,
        score: 5,
        reason: newest ? `A recent ${category.toLowerCase()} release` : `A ${category.toLowerCase()} title from Google Books`,
        cover_url: sanitizeCoverUrl(rawCover),
      };
    })
    .filter((book: Recommendation) => book.title !== "Untitled");

  categoryCache.set(cacheKey, { expiresAt: Date.now() + CATEGORY_CACHE_TTL, recommendations });
  return recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
}

async function getOpenLibraryRecommendations(books: BookRecord[], category: string, bypassCache = false, offset = 0, newest = false) {
  const cacheKey = `open-library:${newest ? "newest" : "relevance"}:${category.toLowerCase()}`;
  const cached = categoryCache.get(cacheKey);
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
  }

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("subject", category.toLowerCase());
  url.searchParams.set("limit", "20");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("language", "eng");
  if (newest) url.searchParams.set("sort", "new");
  url.searchParams.set("fields", "key,title,author_name,subject,cover_i,isbn");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return [];

  const payload = await response.json();
  const recommendations = (payload.docs ?? [])
    .filter((item: { subject?: string[] }) =>
      item.subject?.some((value) => matchesCategory(value, category)),
    )
    .map((item: { key?: string; title?: string; author_name?: string[]; cover_i?: number; isbn?: string[] }) => {
      let coverUrl: string | null = null;
      if (item.cover_i) {
        coverUrl = `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg`;
      } else if (item.isbn?.[0]) {
        coverUrl = `https://covers.openlibrary.org/b/isbn/${item.isbn[0]}-L.jpg`;
      }
      return {
        id: item.key ?? item.title ?? crypto.randomUUID(),
        title: item.title ?? "Untitled",
        author: item.author_name?.join(", ") ?? "Unknown author",
        isbn: item.isbn?.[0] ?? null,
        genre: category,
        status: "Want to Read" as const,
        rating: 0,
        score: 4,
        reason: newest ? `A recent ${category.toLowerCase()} release` : `A ${category.toLowerCase()} title from Open Library`,
        cover_url: coverUrl,
      };
    })
    .filter((book: Recommendation) => book.title !== "Untitled");

  categoryCache.set(cacheKey, {
    expiresAt: Date.now() + CATEGORY_CACHE_TTL,
    recommendations,
  });

  return recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
}

function interleave<T>(...lists: T[][]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index++) {
    for (const list of lists) {
      if (list[index]) result.push(list[index]);
    }
  }
  return result;
}

async function getExternalRecommendations(books: BookRecord[], category: string, bypassCache = false, offset = 0) {
  const [googleNewest, openLibraryNewest, googleRelevant, openLibraryRelevant] = await Promise.all([
    getGoogleBookRecommendations(books, category, bypassCache, 0, true).catch(() => []),
    getOpenLibraryRecommendations(books, category, bypassCache, 0, true).catch(() => []),
    getGoogleBookRecommendations(books, category, bypassCache, offset).catch(() => []),
    getOpenLibraryRecommendations(books, category, bypassCache, offset).catch(() => []),
  ]);
  const combined = interleave<Recommendation>(googleNewest, googleRelevant, openLibraryNewest, openLibraryRelevant);
  return combined.filter(
    (book, index) => combined.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(book.title)) === index,
  );
}

async function getFollowedHighRatedCategories(request: Request, userGenres: string[] = []) {
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("feature_flags")
    .eq("id", user.id)
    .maybeSingle();

  const flags = resolveFeatureFlags(userProfile?.feature_flags);
  const strictMatch = isFeatureEnabled(flags, "strict_peer_genre_match");

  const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
  const followingIds = (follows ?? []).map((follow) => follow.following_id);
  if (followingIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("id", followingIds)
    .eq("is_public", true)
    .eq("public_library", true)
    .eq("public_ratings", true);
  const publicIds = (profiles ?? []).map((profile) => profile.id);
  if (publicIds.length === 0) return [];

  const { data: books } = await supabase
    .from("books")
    .select("genre, categories")
    .in("user_id", publicIds)
    .eq("status", "Read")
    .gte("rating", 4);

  const categories = [...new Set((books ?? []).flatMap((book) =>
    Array.isArray(book.categories) && book.categories.length > 0 ? book.categories : [book.genre],
  ))];

  if (strictMatch && userGenres.length > 0) {
    const userGenreSet = new Set(userGenres.map((g) => g.toLowerCase()));
    return categories.filter((c) => userGenreSet.has(c.toLowerCase()));
  }

  return categories;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    books?: BookRecord[];
    exploreGenre?: string;
    preferredCategories?: string[];
    refresh?: boolean;
    refreshSeed?: number;
  };

  const books = body.books ?? [];
  const exploreGenre = body.exploreGenre ?? "For You";
  const preferredCategories = body.preferredCategories ?? [];
  const refresh = Boolean(body.refresh);
  const refreshSeed = refresh ? body.refreshSeed ?? Date.now() : 0;
  const providerOffset = refresh ? (refreshSeed % 4) * 12 : 0;
  const supabase = await createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  const { data: dismissalRows } = user
    ? await supabase.from("recommendation_dismissals").select("title").eq("user_id", user.id)
    : { data: [] };
  const dismissedTitles = new Set((dismissalRows ?? []).map((item) => normalizeTitle(item.title)));
  const excludedTitles = new Set([...dismissedTitles, ...books.map((book) => normalizeTitle(book.title))]);
  const isAllowed = (recommendation: Recommendation) =>
    typeof recommendation.title === "string" && !excludedTitles.has(normalizeTitle(recommendation.title));

  const readBooks = books.filter((book) => book.status === "Read");
  const curatedCategoriesFor = (book: BookRecord) =>
    [...new Set(getBookCategories(book).map(toCuratedGenre).filter((genre): genre is string => Boolean(genre)))];
  const curatedPreferred = [...new Set(preferredCategories.map(toCuratedGenre).filter((genre): genre is string => Boolean(genre)))];

  const genreScores = new Map<string, number>();
  readBooks.forEach((book) => {
    curatedCategoriesFor(book).forEach((genre) => {
      genreScores.set(genre, (genreScores.get(genre) ?? 0) + (book.rating >= 4 ? 3 : 1));
    });
  });
  curatedPreferred.forEach((genre) => genreScores.set(genre, (genreScores.get(genre) ?? 0) + 5));

  const rankedGenres = [...genreScores.keys()].sort((a, b) => (genreScores.get(b) ?? 0) - (genreScores.get(a) ?? 0));
  const explorationGenres = allGenres.filter((genre) => !rankedGenres.includes(genre));
  const rotation = refreshSeed % Math.max(1, explorationGenres.length);
  const rotatedExploration = [...explorationGenres.slice(rotation), ...explorationGenres.slice(0, rotation)];
  const forYouGenres = [...rankedGenres.slice(0, 5), ...rotatedExploration].slice(0, 6);

  const followedCategories = exploreGenre === "For You"
    ? await getFollowedHighRatedCategories(request, rankedGenres).catch(() => [])
    : [];
  const withSocialProof = (recommendation: Recommendation) => ({
    ...recommendation,
    socialProof: followedCategories.some((category) => matchesCategory(recommendation.genre, category))
      ? "Highly rated by a reader you follow"
      : undefined,
  });

  if (openai) {
    try {
      const favoriteTitles = readBooks
        .filter((book) => book.rating >= 4)
        .slice(0, 30)
        .map((book) => `${book.title} by ${book.author}`);
      const prompt = [
        "You are a book recommendation engine.",
        `Return a JSON array of ${RESULT_LIMIT} objects with keys: title, author, genre, reason. No prose, no code fences.`,
        `Use only these genre labels: ${JSON.stringify(allGenres)}.`,
        `The reader's strongest genres are: ${JSON.stringify(rankedGenres.slice(0, 6))}.`,
        `Books they loved: ${JSON.stringify(favoriteTitles)}.`,
        `Never recommend these titles: ${JSON.stringify([...dismissedTitles].slice(0, 60))}.`,
        "At least half of the picks should be published in the last two years.",
        exploreGenre === "For You"
          ? "Spread picks across at least four different genres, favoring their strongest genres."
          : `Every pick must be a ${exploreGenre} book.`,
        refresh ? `Give a different set than before (variation ${refreshSeed}).` : "",
      ].join(" ");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const raw = (completion.choices[0]?.message?.content ?? "[]").replace(/```(?:json)?/g, "").trim();
      const parsed = JSON.parse(raw) as Recommendation[];
      const filtered = parsed
        .filter(isAllowed)
        .filter((recommendation) => exploreGenre === "For You" || matchesCategory(recommendation.genre, exploreGenre))
        .map((recommendation, index) => ({
          ...recommendation,
          id: recommendation.id ?? `ai-${refreshSeed}-${index}`,
          genre: exploreGenre === "For You" ? recommendation.genre : exploreGenre,
          status: "Want to Read" as const,
          rating: 0,
        }));

      if (filtered.length >= 4) {
        const shelf = exploreGenre === "For You" ? diversifyRecommendations(filtered, RESULT_LIMIT) : filtered.slice(0, RESULT_LIMIT);
        return Response.json({ recommendations: await enrichCovers(shelf.map(withSocialProof)), source: "openai" });
      }
    } catch (error) {
      console.warn("OpenAI recommendation fetch failed, using catalog fallback", error);
    }
  }

  if (exploreGenre !== "For You") {
    const externalRecommendations = (await getExternalRecommendations(books, exploreGenre, refresh, providerOffset)).filter(isAllowed);
    const shelf = externalRecommendations.length > 0
      ? externalRecommendations.slice(0, RESULT_LIMIT)
      : buildHeuristicRecommendations(books, exploreGenre, preferredCategories, refreshSeed, followedCategories).filter(isAllowed);
    return Response.json({
      recommendations: await enrichCovers(shelf),
      source: externalRecommendations.length > 0 ? "google_books_open_library" : "local_fallback",
    });
  }

  const perGenre = await Promise.all(
    forYouGenres.map((genre, index) => getExternalRecommendations(books, genre, refresh, providerOffset + index * 4).catch(() => [])),
  );
  const balanced = perGenre.flatMap((list) => list.filter(isAllowed).slice(0, 3));
  if (balanced.length > 0) {
    return Response.json({
      recommendations: await enrichCovers(diversifyRecommendations(balanced, RESULT_LIMIT).map(withSocialProof)),
      source: "google_books_open_library",
    });
  }

  return Response.json({
    recommendations: await enrichCovers(buildHeuristicRecommendations(books, exploreGenre, preferredCategories, refreshSeed, followedCategories).filter(isAllowed)),
    source: "local_fallback",
  });
}
