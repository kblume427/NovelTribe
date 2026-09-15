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
  genre_source?: "goodreads" | "catalog_fallback";
  status: BookStatus;
  rating: number;
  review?: string | null;
  isbn?: string | null;
  finished_at?: string | null;
  format?: "Physical" | "E-Book" | "Audiobook" | null;
  custom_shelves?: string[];
};

const IMPORT_GENRE_MAP: Array<{ genre: string; keywords: string[] }> = [
  { genre: "Dark Romance", keywords: ["dark romance"] },
  { genre: "Romantasy", keywords: ["romantasy"] },
  { genre: "Science Fiction", keywords: ["science fiction", "sci-fi", "sci fi", "space opera", "dystopian", "dystopias", "cyberpunk", "time travel"] },
  { genre: "Historical Fiction", keywords: ["historical"] },
  { genre: "Nonfiction", keywords: ["nonfiction", "non-fiction", "biography", "memoir", "self-help", "self help", "business", "true crime", "health"] },
  { genre: "Mystery", keywords: ["mystery", "cozy mystery", "detective", "crime", "police procedural"] },
  { genre: "Thriller", keywords: ["thriller", "psychological thriller", "psychological fiction", "suspense fiction"] },
  { genre: "Suspense", keywords: ["suspense"] },
  { genre: "Horror", keywords: ["horror", "paranormal", "gothic"] },
  { genre: "Fantasy", keywords: ["fantasy", "high fantasy", "urban fantasy", "fairy tale", "mythology", "magic", "witches", "vampires"] },
  { genre: "Romance", keywords: ["romance", "romantic", "fiction romance", "romantic fiction"] },
  { genre: "Adventure", keywords: ["adventure", "action", "travel", "exploration"] },
  { genre: "Contemporary", keywords: ["contemporary", "literary fiction", "literary collections", "general fiction", "fiction general", "juvenile fiction", "young adult", "women's fiction"] },
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
  for (const value of values) {
    const normalizedValue = cleanImportedValue(value).toLowerCase().replace(/[&_/]/g, " ").replace(/\s+/g, " ");
    const match = IMPORT_GENRE_MAP.find((entry) => entry.keywords.some((keyword) => normalizedValue.includes(keyword)));
    if (match) {
      return match.genre;
    }
  }
  return "General Fiction";
}

export function normalizeImportedCategories(values: string[]): string[] {
  const categories = values.flatMap(splitImportedGenres);
  const normalizedCategories = categories.map((category) => {
    const canonical = normalizeImportedGenre([category]);
    return canonical === "General Fiction" ? cleanImportedValue(category) : canonical;
  });
  return Array.from(new Set(normalizedCategories.filter((category) => !/^(fiction|general fiction)$/i.test(category)))).slice(0, 8);
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
    const explicitGoodreadsGenres = genreIndices.flatMap((index) => splitImportedGenres(row[index] ?? ""));
    const importedCategories = normalizeImportedCategories(importedGenreValues);
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
      genre_source: explicitGoodreadsGenres.length > 0 ? "goodreads" : "catalog_fallback",
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

/**
 * Parses a Libby tag or borrowed-history spreadsheet export.
 * Libby exports vary by library and export type, so columns are matched by aliases.
 */
export function parseLibbyCSV(csvText: string): ParsedImportBook[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let insideQuotes = false;
    let current = "";
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') {
        if (insideQuotes && line[index + 1] === '"') {
          current += '"';
          index++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        result.push(cleanImportedValue(current));
        current = "";
      } else {
        current += char;
      }
    }
    result.push(cleanImportedValue(current));
    return result;
  };

  const headers = parseRow(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const findIndex = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const titleIdx = findIndex("title", "name");
  const authorIdx = findIndex("author", "creator");
  if (titleIdx === -1 || authorIdx === -1) return [];

  const isbnIdx = findIndex("isbn", "isbn10", "isbn13", "isbn13identifier");
  const formatIdx = findIndex("format", "binding", "mediatype", "type");
  const tagsIdx = findIndex("tags", "tag", "shelf", "shelves", "collection");
  const statusIdx = findIndex("status", "loanstatus", "availability");
  const dateIdx = findIndex("datereturned", "dateborrowed", "datecompleted", "dateread", "date");

  return lines.slice(1).flatMap((line) => {
    const row = parseRow(line);
    const title = row[titleIdx] ?? "";
    const author = row[authorIdx] ?? "Unknown author";
    if (!title) return [];

    const rawTags = row[tagsIdx] ?? "";
    const rawStatus = `${row[statusIdx] ?? ""} ${rawTags}`.toLowerCase();
    const status: BookStatus = /borrowed|returned|completed|finished|read/.test(rawStatus)
      ? "Read"
      : "Want to Read";
    const rawFormat = (row[formatIdx] ?? "").toLowerCase();
    const format = /audio/.test(rawFormat)
      ? "Audiobook"
      : /ebook|e-book|kindle|overdrive read/.test(rawFormat)
      ? "E-Book"
      : /hardcover|paperback|print|book/.test(rawFormat)
      ? "Physical"
      : null;
    const rawIsbn = (row[isbnIdx] ?? "").replace(/[^0-9X]/gi, "").toUpperCase();
    const isbn = rawIsbn.length === 10 || rawIsbn.length === 13 ? rawIsbn : null;
    const rawDate = row[dateIdx] ?? "";
    const finishedAt = status === "Read" && rawDate && !Number.isNaN(Date.parse(rawDate))
      ? new Date(rawDate).toISOString()
      : null;
    const customShelves = splitImportedGenres(rawTags).filter((tag) => !/^(borrowed|returned|completed|finished|read)$/i.test(tag));

    return [{
      title,
      author,
      genre: "General Fiction",
      categories: undefined,
      genre_source: "catalog_fallback",
      status,
      rating: 0,
      isbn,
      finished_at: finishedAt,
      format,
      custom_shelves: customShelves.length > 0 ? customShelves : undefined,
    }];
  });
}

export function parseLibraryCSV(csvText: string, filename = ""): ParsedImportBook[] {
  const header = csvText.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  const looksLikeLibby = /libby|overdrive/.test(filename.toLowerCase()) ||
    /\b(tags?|loan status|date returned|date borrowed|media type)\b/i.test(header);
  return looksLikeLibby ? parseLibbyCSV(csvText) : parseGoodreadsCSV(csvText);
}
