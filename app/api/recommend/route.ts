import {
  buildHeuristicRecommendations,
  diversifyRecommendations,
  getBookCategories,
  normalizeTitle,
  type BookRecord,
  type Recommendation,
} from "@/lib/recommendations";
import { openai } from "@/lib/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureEnabled, resolveFeatureFlags } from "@/lib/featureFlags";

const categoryCache = new Map<string, { expiresAt: number; recommendations: Recommendation[] }>();
const CATEGORY_CACHE_TTL = 5 * 60 * 1000;
const coverCache = new Map<string, string | null>();

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
      url.searchParams.set("fields", "cover_i");
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const payload = response.ok ? await response.json() : null;
      const coverId = payload?.docs?.[0]?.cover_i;
      const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
      coverCache.set(cacheKey, coverUrl);
      return { ...recommendation, cover_url: coverUrl };
    } catch {
      coverCache.set(cacheKey, null);
      return recommendation;
    }
  }));
}

async function getGoogleBookRecommendations(books: BookRecord[], category: string, bypassCache = false, offset = 0) {
  const cacheKey = `google:${category.toLowerCase()}`;
  const cached = categoryCache.get(cacheKey);
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
  }

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `subject:${category}`);
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("startIndex", String(offset));
  url.searchParams.set("printType", "books");

  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const recommendations = (payload.items ?? [])
    .filter((item: { volumeInfo?: { categories?: string[] } }) =>
      item.volumeInfo?.categories?.some((value) => matchesCategory(value, category)),
    )
    .map((item: { id: string; volumeInfo?: { title?: string; authors?: string[]; categories?: string[]; imageLinks?: { thumbnail?: string; smallThumbnail?: string } } }) => {
      const title = item.volumeInfo?.title ?? "Untitled";
      return {
        id: item.id,
        title,
        author: item.volumeInfo?.authors?.join(", ") ?? "Unknown author",
        genre: category,
        status: "Want to Read" as const,
        rating: 0,
        score: 5,
        reason: `A ${category.toLowerCase()} title from Google Books`,
        cover_url: item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail ?? null,
      };
    })
    .filter((book: Recommendation) => book.title !== "Untitled");

  categoryCache.set(cacheKey, { expiresAt: Date.now() + CATEGORY_CACHE_TTL, recommendations });
  return recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
}

async function getOpenLibraryRecommendations(books: BookRecord[], category: string, bypassCache = false, offset = 0) {
  const cached = categoryCache.get(`open-library:${category.toLowerCase()}`);
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  if (!bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
  }

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("subject", category);
  url.searchParams.set("limit", "12");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("fields", "key,title,author_name,subject");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return [];

  const payload = await response.json();
  const recommendations = (payload.docs ?? [])
    .filter((item: { subject?: string[] }) =>
      item.subject?.some((value) => matchesCategory(value, category)),
    )
    .map((item: { key?: string; title?: string; author_name?: string[]; cover_i?: number }) => ({
      id: item.key ?? item.title ?? crypto.randomUUID(),
      title: item.title ?? "Untitled",
      author: item.author_name?.join(", ") ?? "Unknown author",
      genre: category,
      status: "Want to Read" as const,
      rating: 0,
      score: 4,
      reason: `A ${category.toLowerCase()} title from Open Library`,
      cover_url: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : null,
    }))
    .filter((book: Recommendation) => book.title !== "Untitled");

  categoryCache.set(`open-library:${category.toLowerCase()}`, {
    expiresAt: Date.now() + CATEGORY_CACHE_TTL,
    recommendations,
  });

  return recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
}

async function getExternalRecommendations(books: BookRecord[], category: string, bypassCache = false, offset = 0) {
  const [googleRecommendations, openLibraryRecommendations] = await Promise.all([
    getGoogleBookRecommendations(books, category, bypassCache, offset).catch(() => []),
    getOpenLibraryRecommendations(books, category, bypassCache, offset).catch(() => []),
  ]);
  const combined = [...googleRecommendations, ...openLibraryRecommendations];
  return combined.filter(
    (book, index) => combined.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(book.title)) === index,
  );
}

async function getFollowedHighRatedCategories(userGenres: string[] = []) {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: dismissalRows } = user
    ? await supabase.from("recommendation_dismissals").select("title").eq("user_id", user.id)
    : { data: [] };
  const dismissedTitles = new Set((dismissalRows ?? []).map((item) => normalizeTitle(item.title)));
  const userKnownGenres = [
    ...preferredCategories,
    ...books.filter((b) => b.status === "Read").flatMap(getBookCategories),
  ];
  const followedCategories = exploreGenre === "For You"
    ? await getFollowedHighRatedCategories(userKnownGenres).catch(() => [])
    : [];
  const readCategoryCounts = new Map<string, number>();
  const highRatedCategoryCounts = new Map<string, number>();
  books.filter((book) => book.status === "Read").flatMap(getBookCategories).forEach((category) => {
    readCategoryCounts.set(category, (readCategoryCounts.get(category) ?? 0) + 1);
  });
  books.filter((book) => book.status === "Read" && book.rating >= 4).flatMap(getBookCategories).forEach((category) => {
    highRatedCategoryCounts.set(category, (highRatedCategoryCounts.get(category) ?? 0) + 1);
  });
  const readCategories = [...new Set([...readCategoryCounts.keys(), ...preferredCategories])]
    .sort((a, b) => {
      const score = (category: string) =>
        (readCategoryCounts.get(category) ?? 0) +
        (highRatedCategoryCounts.get(category) ?? 0) * 2 +
        (preferredCategories.includes(category) ? 3 : 0);
      return score(b) - score(a);
    });

  if (openai) {
    try {
      const prompt = [
        "You are building a reading recommendation engine for a book tracker.",
        "Return JSON only with an array of up to 8 objects. Each object should include title, author, genre, score, and reason.",
        `The user has read these books: ${JSON.stringify(books)}`,
        `The user selected recommendation mode: ${exploreGenre}`,
        `The user's preferred categories are: ${JSON.stringify(preferredCategories)}`,
        `Readers the user follows have highly rated books in: ${JSON.stringify(followedCategories)}`,
        refresh ? `Generate a fresh alternative set, variation ${refreshSeed}.` : "",
        exploreGenre === "For You"
          ? "Recommend across genres based on the user's reading history and preferences."
          : `Return only books in the exact ${exploreGenre} genre.`,
      ].join(" ");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const raw = completion.choices[0]?.message?.content ?? "[]";
      const parsed = JSON.parse(raw);
      const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));
      const filteredRecommendations = (parsed as Recommendation[]).filter(
        (recommendation) =>
          typeof recommendation.title === "string" &&
          !existingTitles.has(normalizeTitle(recommendation.title)) &&
          (exploreGenre === "For You" || matchesCategory(recommendation.genre, exploreGenre)),
      );

      if (exploreGenre !== "For You" && filteredRecommendations.length > 0) {
        return Response.json({
          recommendations: await enrichCovers(filteredRecommendations.map((recommendation) => ({
            ...recommendation,
            genre: exploreGenre,
            socialProof: followedCategories.some((category) => matchesCategory(recommendation.genre, category))
              ? "Highly rated by a reader you follow"
              : undefined,
          }))),
          source: "openai",
        });
      }

      if (exploreGenre === "For You" && filteredRecommendations.length > 0) {
        return Response.json({
          recommendations: await enrichCovers(diversifyRecommendations(filteredRecommendations).map((recommendation) => ({
            ...recommendation,
            socialProof: followedCategories.some((category) => matchesCategory(recommendation.genre, category))
              ? "Highly rated by a reader you follow"
              : undefined,
          }))),
          source: "openai",
        });
      }
    } catch (error) {
      console.warn("OpenAI recommendation fetch failed, using local fallback", error);
    }
  }

  if (exploreGenre !== "For You") {
    const externalRecommendations = await getExternalRecommendations(books, exploreGenre, refresh, providerOffset);
    if (externalRecommendations.length > 0) {
      return Response.json({ recommendations: await enrichCovers(externalRecommendations.slice(0, 8)), source: "google_books_open_library" });
    }
  }

  if (readCategories.length > 0) {
    const categoryRecommendations = await Promise.all(
      readCategories.slice(0, 5).map((category, index) => getExternalRecommendations(books, category, refresh, providerOffset + index * 12)),
    );
    const googleRecommendations = categoryRecommendations
      .flat()
      .filter((book, index, allBooks) => allBooks.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(book.title)) === index)
      .slice(0, 12);

    if (googleRecommendations.length > 0) {
      return Response.json({
        recommendations: await enrichCovers(diversifyRecommendations(googleRecommendations).map((recommendation) => ({
          ...recommendation,
          socialProof: followedCategories.some((category) => matchesCategory(recommendation.genre, category))
            ? "Highly rated by a reader you follow"
            : undefined,
        }))),
        source: "google_books_open_library",
      });
    }
  }

  return Response.json({
    recommendations: await enrichCovers(buildHeuristicRecommendations(books, exploreGenre, preferredCategories, refreshSeed, followedCategories).filter((book) => !dismissedTitles.has(normalizeTitle(book.title)))),
    source: "local_fallback",
  });
}
