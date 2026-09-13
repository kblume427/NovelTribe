import {
  buildHeuristicRecommendations,
  getBookCategories,
  normalizeTitle,
  type BookRecord,
  type Recommendation,
} from "@/lib/recommendations";
import { openai } from "@/lib/server";

function matchesCategory(value: unknown, category: string) {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedCategory = category.toLowerCase();
  return normalizedValue.includes(normalizedCategory) || normalizedCategory.includes(normalizedValue);
}

async function getGoogleBookRecommendations(books: BookRecord[], category: string) {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `subject:${category}`);
  url.searchParams.set("maxResults", "6");
  url.searchParams.set("printType", "books");

  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  return (payload.items ?? [])
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
    .filter((book: Recommendation) => !existingTitles.has(normalizeTitle(book.title)));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    books?: BookRecord[];
    exploreGenre?: string;
  };

  const books = body.books ?? [];
  const exploreGenre = body.exploreGenre ?? "For You";
  const readCategoryCounts = new Map<string, number>();
  books.filter((book) => book.status === "Read").flatMap(getBookCategories).forEach((category) => {
    readCategoryCounts.set(category, (readCategoryCounts.get(category) ?? 0) + 1);
  });
  const readCategories = [...readCategoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  if (openai) {
    try {
      const prompt = [
        "You are building a reading recommendation engine for a book tracker.",
        "Return JSON only with an array of 4 objects. Each object should include title, author, genre, score, and reason.",
        `The user has read these books: ${JSON.stringify(books)}`,
        `The user selected recommendation mode: ${exploreGenre}`,
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
          (exploreGenre === "For You"
            ? readCategories.some((category) => matchesCategory(recommendation.genre, category))
            : matchesCategory(recommendation.genre, exploreGenre)),
      );
      const dominantCategory = readCategories[0];
      const dominantRecommendations = dominantCategory
        ? filteredRecommendations.filter((recommendation) => matchesCategory(recommendation.genre, dominantCategory))
        : [];

      if (exploreGenre !== "For You" && filteredRecommendations.length > 0) {
        return Response.json({
          recommendations: filteredRecommendations.map((recommendation) => ({
            ...recommendation,
            genre: exploreGenre,
          })),
        });
      }

      if (exploreGenre === "For You" && dominantRecommendations.length > 0) {
        return Response.json({ recommendations: dominantRecommendations });
      }
    } catch (error) {
      console.warn("OpenAI recommendation fetch failed, using local fallback", error);
    }
  }

  if (exploreGenre !== "For You") {
    const googleRecommendations = await getGoogleBookRecommendations(books, exploreGenre).catch(() => []);
    if (googleRecommendations.length > 0) {
      return Response.json({ recommendations: googleRecommendations });
    }
  }

  if (readCategories.length > 0) {
    const categoryRecommendations = await Promise.all(
      readCategories.slice(0, 3).map((category) => getGoogleBookRecommendations(books, category).catch(() => [])),
    );
    const googleRecommendations = categoryRecommendations
      .flat()
      .filter((book, index, allBooks) => allBooks.findIndex((candidate) => normalizeTitle(candidate.title) === normalizeTitle(book.title)) === index)
      .slice(0, 4);

    if (googleRecommendations.length > 0) {
      return Response.json({ recommendations: googleRecommendations });
    }
  }

  return Response.json({
    recommendations: buildHeuristicRecommendations(books, exploreGenre),
  });
}
