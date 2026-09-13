export type BookStatus = "Read" | "Currently Reading" | "Want to Read";

export type BookRecord = {
  id: string | number;
  title: string;
  author: string;
  genre: string;
  status: BookStatus;
  rating: number;
  finished_at?: string | null;
  isbn?: string | null;
  categories?: string[] | null;
  review?: string | null;
};

export type Recommendation = BookRecord & {
  score: number;
  reason: string;
};

export const starterBooks: BookRecord[] = [
  { id: 1, title: "Piranesi", author: "Susanna Clarke", genre: "Fantasy", status: "Read", rating: 5 },
  { id: 2, title: "The House in the Cerulean Sea", author: "TJ Klune", genre: "Fantasy", status: "Read", rating: 5 },
  { id: 3, title: "Project Hail Mary", author: "Andy Weir", genre: "Science Fiction", status: "Read", rating: 4 },
  { id: 4, title: "The Silent Patient", author: "Alex Michaelides", genre: "Thriller", status: "Read", rating: 4 },
  { id: 5, title: "The Night Circus", author: "Erin Morgenstern", genre: "Fantasy", status: "Currently Reading", rating: 5 },
  { id: 6, title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin", genre: "Contemporary", status: "Want to Read", rating: 0 },
];

export const allGenres = [
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Thriller",
  "Suspense",
  "Romance",
  "Dark Romance",
  "Romantasy",
  "Contemporary",
  "Historical Fiction",
  "Horror",
  "Nonfiction",
  "Adventure",
];

export const catalog: BookRecord[] = [
  { id: 101, title: "The Midnight Library", author: "Matt Haig", genre: "Fantasy", status: "Read", rating: 5 },
  { id: 102, title: "The Book of Form and Emptiness", author: "Catherine Liu", genre: "Contemporary", status: "Read", rating: 4 },
  { id: 103, title: "The Martian", author: "Andy Weir", genre: "Science Fiction", status: "Read", rating: 5 },
  { id: 104, title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson", genre: "Mystery", status: "Read", rating: 4 },
  { id: 105, title: "The Invisible Life of Addie LaRue", author: "V.E. Schwab", genre: "Fantasy", status: "Read", rating: 5 },
  { id: 106, title: "Big Little Lies", author: "Liane Moriarty", genre: "Mystery", status: "Read", rating: 4 },
  { id: 107, title: "The Secret Life of Bees", author: "Sue Monk Kidd", genre: "Contemporary", status: "Read", rating: 5 },
  { id: 108, title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", genre: "Science Fiction", status: "Read", rating: 5 },
  { id: 109, title: "The Night Circus", author: "Erin Morgenstern", genre: "Fantasy", status: "Read", rating: 5 },
  { id: 110, title: "The Silent Patient", author: "Alex Michaelides", genre: "Thriller", status: "Read", rating: 4 },
  { id: 120, title: "The Last Thing He Told Me", author: "Laura Dave", genre: "Suspense", status: "Read", rating: 4 },
  { id: 121, title: "The Couple Next Door", author: "Shari Lapena", genre: "Suspense", status: "Read", rating: 4 },
  { id: 111, title: "The Seven Husbands of Evelyn Hugo", author: "Taylor Jenkins Reid", genre: "Romance", status: "Read", rating: 5 },
  { id: 116, title: "Haunting Adeline", author: "H.D. Carlton", genre: "Dark Romance", status: "Read", rating: 4 },
  { id: 117, title: "The Ritual", author: "Shantel Tessier", genre: "Dark Romance", status: "Read", rating: 4 },
  { id: 118, title: "Fourth Wing", author: "Rebecca Yarros", genre: "Romantasy", status: "Read", rating: 5 },
  { id: 119, title: "A Court of Thorns and Roses", author: "Sarah J. Maas", genre: "Romantasy", status: "Read", rating: 5 },
  { id: 112, title: "The Women", author: "Kristin Hannah", genre: "Historical Fiction", status: "Read", rating: 4 },
  { id: 113, title: "The Hotel on the Corner of Bitter and Sweet", author: "Jamie Ford", genre: "Historical Fiction", status: "Read", rating: 4 },
  { id: 114, title: "The Ruins", author: "Scott Smith", genre: "Horror", status: "Read", rating: 3 },
  { id: 115, title: "The Lost City of Z", author: "David Grann", genre: "Adventure", status: "Read", rating: 5 },
];

export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getBookCategories(book: BookRecord) {
  return book.categories?.length ? book.categories : [book.genre];
}

export function diversifyRecommendations(recommendations: Recommendation[], limit = 8) {
  const grouped = new Map<string, Recommendation[]>();
  recommendations.forEach((recommendation) => {
    const category = recommendation.genre || "Other";
    grouped.set(category, [...(grouped.get(category) ?? []), recommendation]);
  });

  const result: Recommendation[] = [];
  while (result.length < limit && grouped.size > 0) {
    for (const [category, items] of grouped) {
      const next = items.shift();
      if (next) result.push(next);
      if (items.length === 0) grouped.delete(category);
      if (result.length === limit) break;
    }
  }

  return result;
}

export function buildHeuristicRecommendations(
  books: BookRecord[],
  exploreGenre: string,
  preferredCategories: string[] = [],
): Recommendation[] {
  const readGenres = new Set(
    books.filter((book) => book.status === "Read").flatMap(getBookCategories),
  );
  const readCategoryCounts = new Map<string, number>();
  const highRatedCategoryCounts = new Map<string, number>();
  books.filter((book) => book.status === "Read").flatMap(getBookCategories).forEach((category) => {
    readCategoryCounts.set(category, (readCategoryCounts.get(category) ?? 0) + 1);
  });
  books.filter((book) => book.status === "Read" && book.rating >= 4).flatMap(getBookCategories).forEach((category) => {
    highRatedCategoryCounts.set(category, (highRatedCategoryCounts.get(category) ?? 0) + 1);
  });
  const existingTitles = new Set(books.map((book) => normalizeTitle(book.title)));

  const recommendations = catalog
    .filter(
      (book) =>
        !existingTitles.has(normalizeTitle(book.title)) &&
        (exploreGenre === "For You" || getBookCategories(book).includes(exploreGenre)),
    )
    .map((book) => {
      let score = 0;
      let reason = "Popular with readers like you";

      if (readGenres.has(book.genre)) {
        score += (readCategoryCounts.get(book.genre) ?? 0) * 2;
        score += (highRatedCategoryCounts.get(book.genre) ?? 0) * 5;
        reason = `You already enjoy ${book.genre.toLowerCase()} picks`;
      }

      if (preferredCategories.includes(book.genre)) {
        score += 7;
        reason = `A category you said you enjoy: ${book.genre.toLowerCase()}`;
      }

      if (exploreGenre !== "For You" && book.genre === exploreGenre) {
        score += 3;
        reason = `A strong ${exploreGenre.toLowerCase()} pick for your next read`;
      }

      if (book.rating >= 4) {
        score += 2;
      }

      return { ...book, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return exploreGenre === "For You"
    ? diversifyRecommendations(recommendations)
    : recommendations.slice(0, 8);
}
