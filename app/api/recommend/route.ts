import {
  buildHeuristicRecommendations,
  diversifyRecommendations,
  getBookCategories,
  normalizeTitle,
  type BookRecord,
  type Recommendation,
} from "@/lib/recommendations";
import { openai } from "@/lib/server";

const categoryCache = new Map<string, { expiresAt: number; recommendations: Recommendation[] }>();
const CATEGORY_CACHE_TTL = 5 * 60 * 1000;

function matchesCategory(value: unknown, category: string) {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedCategory = category.toLowerCase();
  return normalizedValue.includes(normalizedCategory) || normalizedCategory.includes(normalizedValue);
}

async function getGoogleBookRecommendations(books: BookRecord[], category: string) {
  const cacheKey = `google:${category.toLowerCase()}`;
  const cached = categoryCache.get(cacheKey);
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  if (cached && cached.expiresAt > Date.now()) {
    return cached.recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
  }

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `subject:${category}`);
  url.searchParams.set("maxResults", "12");
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
    .map((item: { id: string; volumeInfo?: { title?: string; authors?: string[]; categories?: string[] } }) => {
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
      };
    })
    .filter((book: Recommendation) => book.title !== "Untitled");

  categoryCache.set(cacheKey, { expiresAt: Date.now() + CATEGORY_CACHE_TTL, recommendations });
  return recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
}

async function getOpenLibraryRecommendations(books: BookRecord[], category: string) {
  const cached = categoryCache.get(`open-library:${category.toLowerCase()}`);
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  if (cached && cached.expiresAt > Date.now()) {
    return cached.recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
  }

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("subject", category);
  url.searchParams.set("limit", "12");
  url.searchParams.set("fields", "key,title,author_name,subject");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return [];

  const payload = await response.json();
  const recommendations = (payload.docs ?? [])
    .map((item: { key?: string; title?: string; author_name?: string[] }) => ({
      id: item.key ?? item.title ?? crypto.randomUUID(),
      title: item.title ?? "Untitled",
      author: item.author_name?.join(", ") ?? "Unknown author",
      genre: category,
      status: "Want to Read" as const,
      rating: 0,
      score: 4,
      reason: `A ${category.toLowerCase()} title from Open Library`,
    }))
    .filter((book: Recommendation) => book.title !== "Untitled");

  categoryCache.set(`open-library:${category.toLowerCase()}`, {
    expiresAt: Date.now() + CATEGORY_CACHE_TTL,
    recommendations,
  });

  return recommendations.filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
}

async function getExternalRecommendations(books: BookRecord[], category: string) {
  const [googleRecommendations, openLibraryRecommendations] = await Promise.all([
    getGoogleBookRecommendations(books, category).catch(() => []),
    getOpenLibraryRecommendations(books, category).catch(() => []),
  ]);
  const combined = [...googleRecommendations, ...openLibraryRecommendations];
  return combined.filter(
    (book, index) => combined.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(book.title)) === index,
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    books?: BookRecord[];
    exploreGenre?: string;
    preferredCategories?: string[];
  };

  const books = body.books ?? [];
  const exploreGenre = body.exploreGenre ?? "For You";
  const preferredCategories = body.preferredCategories ?? [];
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
          recommendations: filteredRecommendations.map((recommendation) => ({
            ...recommendation,
            genre: exploreGenre,
          })),
        });
      }

      if (exploreGenre === "For You" && filteredRecommendations.length > 0) {
        return Response.json({ recommendations: diversifyRecommendations(filteredRecommendations) });
      }
    } catch (error) {
      console.warn("OpenAI recommendation fetch failed, using local fallback", error);
    }
  }

  if (exploreGenre !== "For You") {
    const externalRecommendations = await getExternalRecommendations(books, exploreGenre);
    if (externalRecommendations.length > 0) {
      return Response.json({ recommendations: externalRecommendations.slice(0, 8) });
    }
  }

  if (readCategories.length > 0) {
    const categoryRecommendations = await Promise.all(
      readCategories.slice(0, 5).map((category) => getExternalRecommendations(books, category)),
    );
    const googleRecommendations = categoryRecommendations
      .flat()
      .filter((book, index, allBooks) => allBooks.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(book.title)) === index)
      .slice(0, 12);

    if (googleRecommendations.length > 0) {
      return Response.json({ recommendations: diversifyRecommendations(googleRecommendations) });
    }
  }

  return Response.json({
    recommendations: buildHeuristicRecommendations(books, exploreGenre, preferredCategories),
  });
}
