import type { BookRecord, BookStatus } from "@/lib/recommendations";

export function exportBooksToJSON(books: BookRecord[]): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      platform: "NovelTribe",
      version: 1,
      total_books: books.length,
      books: books.map((b) => ({
        title: b.title,
        author: b.author,
        genre: b.genre,
        status: b.status,
        rating: b.rating,
        finished_at: b.finished_at ?? null,
        isbn: b.isbn ?? null,
        categories: b.categories ?? [],
        review: b.review ?? null,
        mood_tags: b.mood_tags ?? [],
        quotes: b.quotes ?? [],
        format: b.format ?? null,
        audiobook_narrator: b.audiobook_narrator ?? null,
        audiobook_duration: b.audiobook_duration ?? null,
        custom_shelves: b.custom_shelves ?? [],
        total_pages: b.total_pages ?? null,
        current_page: b.current_page ?? null,
      })),
    },
    null,
    2,
  );
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportBooksToCSV(books: BookRecord[]): string {
  const headers = [
    "Title",
    "Author",
    "Genre",
    "Status",
    "Rating",
    "Review",
    "Finished Date",
    "ISBN",
    "Mood Tags",
    "Quotes",
    "Format",
    "Audiobook Narrator",
    "Audiobook Duration",
    "Custom Shelves",
    "Total Pages",
    "Current Page",
  ];

  const rows = books.map((b) => [
    escapeCsvField(b.title),
    escapeCsvField(b.author),
    escapeCsvField(b.genre),
    escapeCsvField(b.status),
    escapeCsvField(b.rating),
    escapeCsvField(b.review ?? ""),
    escapeCsvField(b.finished_at ?? ""),
    escapeCsvField(b.isbn ?? ""),
    escapeCsvField((b.mood_tags ?? []).join(", ")),
    escapeCsvField((b.quotes ?? []).join(" | ")),
    escapeCsvField(b.format ?? ""),
    escapeCsvField(b.audiobook_narrator ?? ""),
    escapeCsvField(b.audiobook_duration ?? ""),
    escapeCsvField((b.custom_shelves ?? []).join(", ")),
    escapeCsvField(b.total_pages ?? ""),
    escapeCsvField(b.current_page ?? ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export type ParsedImportBook = {
  title: string;
  author: string;
  genre: string;
  categories?: string[];
  status: BookStatus;
  rating: number;
  review?: string | null;
  isbn?: string | null;
  finished_at?: string | null;
  format?: "Physical" | "E-Book" | "Audiobook" | null;
  custom_shelves?: string[];
};

const IMPORT_GENRE_RULES: Array<{ genre: string; patterns: RegExp[] }> = [
  { genre: "Dark Romance", patterns: [/dark romance/i] },
  { genre: "Romantasy", patterns: [/romantasy/i] },
  { genre: "Science Fiction", patterns: [/science fiction/i, /sci[ -]?fi/i, /space opera/i, /dystopian/i, /cyberpunk/i, /time travel/i] },
  { genre: "Historical Fiction", patterns: [/historical/i, /historical fiction/i, /historical romance/i] },
  { genre: "Nonfiction", patterns: [/nonfiction/i, /non-fiction/i, /biography/i, /memoir/i, /self[- ]help/i, /business/i, /true crime/i, /health/i] },
  { genre: "Mystery", patterns: [/mystery/i, /cozy mystery/i, /detective/i, /crime/i] },
  { genre: "Thriller", patterns: [/thriller/i, /psychological thriller/i] },
  { genre: "Suspense", patterns: [/suspense/i] },
  { genre: "Horror", patterns: [/horror/i, /paranormal/i, /gothic/i] },
  { genre: "Fantasy", patterns: [/fantasy/i, /high fantasy/i, /urban fantasy/i, /fairy tale/i, /mythology/i, /magic/i] },
  { genre: "Romance", patterns: [/romance/i, /romantic/i] },
  { genre: "Adventure", patterns: [/adventure/i, /action/i, /travel/i, /exploration/i] },
  { genre: "Contemporary", patterns: [/contemporary/i, /literary fiction/i, /literary collections/i, /general fiction/i, /juvenile fiction/i, /young adult/i, /^fiction$/i] },
];

function cleanImportedValue(value: string): string {
  return value.replace(/^\s*["']|["']\s*$/g, "").replace(/\s+/g, " ").trim();
}

function splitImportedGenres(value: string): string[] {
  return value
    .split(/[|;,/]/)
    .map(cleanImportedValue)
    .filter(Boolean);
}

export function normalizeImportedGenre(values: string[]): string {
  const matches = IMPORT_GENRE_RULES.flatMap((rule) =>
    values.flatMap((value) => rule.patterns.filter((pattern) => pattern.test(value)).map(() => rule.genre)),
  );
  if (matches.length > 0) {
    return matches[0];
  }
  return "General Fiction";
}

function getImportedGenres(values: string[]): string[] {
  const categories = values.flatMap(splitImportedGenres);
  const canonicalGenres = categories
    .map((category) => normalizeImportedGenre([category]))
    .filter((genre) => genre !== "General Fiction");
  const originalCategories = categories.filter((category) => !/^fiction$/i.test(category));
  return Array.from(new Set([...canonicalGenres, ...originalCategories])).slice(0, 8);
}

/**
 * Parses a standard Goodreads library export CSV or NovelTribe CSV export.
 */
export function parseGoodreadsCSV(csvText: string): ParsedImportBook[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header line to match columns dynamically
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let insideQuotes = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headerRow = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const titleIdx = headerRow.findIndex((h) => h === "title");
  const authorIdx = headerRow.findIndex((h) => h === "author" || h === "authorlf");
  const ratingIdx = headerRow.findIndex((h) => h === "myrating" || h === "rating");
  const shelvesIdx = headerRow.findIndex((h) => h === "exclusiveshelf" || h === "status" || h === "bookshelves");
  const reviewIdx = headerRow.findIndex((h) => h === "myreview" || h === "review");
  const isbnIdx = headerRow.findIndex((h) => h === "isbn13" || h === "isbn");
  const dateReadIdx = headerRow.findIndex((h) => h === "dateread" || h === "finisheddate");
  const bindingIdx = headerRow.findIndex((h) => h === "binding" || h === "format");
  const genreIndices = headerRow.reduce<number[]>((indices, header, index) => {
    if (["genre", "genres", "category", "categories", "subjects", "bookgenre"].includes(header)) {
      indices.push(index);
    }
    return indices;
  }, []);

  if (titleIdx === -1 || authorIdx === -1) {
    return [];
  }

  const books: ParsedImportBook[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (!row[titleIdx]) continue;

    const title = row[titleIdx].replace(/^="?|"?$/g, "").trim();
    const author = (row[authorIdx] ?? "Unknown author").replace(/^="?|"?$/g, "").trim();
    if (!title) continue;

    const rawRating = parseInt(row[ratingIdx] ?? "0", 10);
    const rating = isNaN(rawRating) ? 0 : Math.max(0, Math.min(5, rawRating));

    const rawShelf = (row[shelvesIdx] ?? "").toLowerCase();
    const importedGenreValues = [
      ...genreIndices.flatMap((index) => splitImportedGenres(row[index] ?? "")),
      ...splitImportedGenres(row[shelvesIdx] ?? ""),
    ];
    const importedCategories = getImportedGenres(importedGenreValues);
    const genre = normalizeImportedGenre(importedGenreValues);
    let status: BookStatus = "Read";
    if (rawShelf.includes("currently-reading") || rawShelf.includes("currently reading")) {
      status = "Currently Reading";
    } else if (rawShelf.includes("to-read") || rawShelf.includes("want to read") || rawShelf.includes("wishlist")) {
      status = "Want to Read";
    } else if (rating === 0 && !rawShelf.includes("read")) {
      status = "Want to Read";
    }

    const review = row[reviewIdx]?.trim() || null;
    const rawIsbn = row[isbnIdx]?.replace(/[^0-9X]/gi, "").trim();
    const isbn = rawIsbn && (rawIsbn.length === 10 || rawIsbn.length === 13) ? rawIsbn : null;

    let finished_at: string | null = null;
    if (status === "Read") {
      const rawDate = row[dateReadIdx]?.trim();
      if (rawDate && !isNaN(Date.parse(rawDate))) {
        finished_at = new Date(rawDate).toISOString();
      } else {
        finished_at = new Date().toISOString();
      }
    }

    // Detect Kindle / E-Book from Goodreads Binding column or shelf tags
    const rawBinding = (row[bindingIdx] ?? "").toLowerCase();
    let format: "Physical" | "E-Book" | "Audiobook" | null = null;
    const isKindleOrEbook =
      rawBinding.includes("kindle") ||
      rawBinding.includes("ebook") ||
      rawBinding.includes("nook") ||
      rawShelf.includes("kindle") ||
      rawShelf.includes("ebook");
    const isAudio =
      rawBinding.includes("audio") ||
      rawBinding.includes("audible") ||
      rawShelf.includes("audio");

    if (isAudio) {
      format = "Audiobook";
    } else if (isKindleOrEbook) {
      format = "E-Book";
    }

    const customShelves: string[] = [];
    if (rawBinding.includes("kindle") || rawShelf.includes("kindle")) {
      customShelves.push("Kindle");
    }

    books.push({
      title,
      author,
      genre,
      categories: importedCategories.length > 0 ? importedCategories : undefined,
      status,
      rating,
      review: review ? review.slice(0, 1000) : null,
      isbn,
      finished_at,
      format,
      custom_shelves: customShelves.length > 0 ? customShelves : undefined,
    });
  }

  return books;
}
