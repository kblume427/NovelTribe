import { NextRequest } from "next/server";
import { sanitizeCoverUrl, normalizeIsbn } from "@/lib/covers";

const searchCache = new Map<string, { expiresAt: number; payload: unknown }>();
const SEARCH_CACHE_TTL = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return Response.json({ items: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.payload);
  }

  const cleanIsbn = normalizeIsbn(query);
  const isAsin = /^B0[A-Z0-9]{8}$/i.test(query.trim());
  const searchQuery = cleanIsbn
    ? `isbn:${cleanIsbn}`
    : isAsin
    ? query.trim()
    : query;

  const googleBooksUrl = new URL("https://www.googleapis.com/books/v1/volumes");
  googleBooksUrl.searchParams.set("q", searchQuery);
  googleBooksUrl.searchParams.set("maxResults", "12");
  googleBooksUrl.searchParams.set("printType", "books");

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    googleBooksUrl.searchParams.set("key", apiKey);
  }

  let payload: { items?: Array<{ id?: string; volumeInfo?: Record<string, unknown> }> } | null = null;
  let googleOk = false;

  try {
    const response = await fetch(googleBooksUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      payload = await response.json();
      googleOk = Boolean(payload && Array.isArray(payload.items) && payload.items.length > 0);
    }
  } catch {
    googleOk = false;
  }

  if (googleOk && payload && payload.items) {
    // Sanitize and upgrade image links from Google Books
    const sanitizedItems = payload.items.map((item) => {
      const vol = (item.volumeInfo || {}) as {
        imageLinks?: {
          extraLarge?: string;
          large?: string;
          medium?: string;
          thumbnail?: string;
          smallThumbnail?: string;
        };
        industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
      };

      const rawCover = vol.imageLinks?.extraLarge || vol.imageLinks?.large || vol.imageLinks?.medium || vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail;
      let cover = sanitizeCoverUrl(rawCover);

      if (!cover && vol.industryIdentifiers) {
        const isbnObj = vol.industryIdentifiers.find((id) => id.identifier && /^(?:\d{10}|\d{13})$/.test(id.identifier));
        if (isbnObj && isbnObj.identifier) {
          cover = `https://covers.openlibrary.org/b/isbn/${isbnObj.identifier}-L.jpg`;
        }
      }

      return {
        ...item,
        volumeInfo: {
          ...vol,
          imageLinks: cover ? { thumbnail: cover, smallThumbnail: cover } : undefined,
        },
      };
    });

    const finalPayload = { items: sanitizedItems };
    searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL, payload: finalPayload });
    return Response.json(finalPayload);
  }

  // Open Library Fallback
  try {
    const openLibraryUrl = new URL("https://openlibrary.org/search.json");
    if (cleanIsbn) {
      openLibraryUrl.searchParams.set("isbn", cleanIsbn);
    } else {
      openLibraryUrl.searchParams.set("q", query);
    }
    openLibraryUrl.searchParams.set("limit", "12");
    openLibraryUrl.searchParams.set("fields", "key,title,author_name,subject,cover_i,isbn");

    const fallbackResponse = await fetch(openLibraryUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (fallbackResponse.ok) {
      const fallback = await fallbackResponse.json();
      const docs = (fallback.docs ?? []) as Array<{
        key?: string;
        title?: string;
        author_name?: string[];
        subject?: string[];
        cover_i?: number;
        isbn?: string[];
      }>;

      const fallbackPayload = {
        items: docs.map((item) => {
          let coverUrl: string | undefined = undefined;
          if (item.cover_i) {
            coverUrl = `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg`;
          } else if (item.isbn && item.isbn.length > 0) {
            coverUrl = `https://covers.openlibrary.org/b/isbn/${item.isbn[0]}-L.jpg`;
          } else if (cleanIsbn) {
            coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
          }

          return {
            id: item.key ?? item.title ?? crypto.randomUUID(),
            volumeInfo: {
              title: item.title ?? "Untitled",
              authors: item.author_name ?? ["Unknown Author"],
              categories: item.subject?.slice(0, 5),
              imageLinks: coverUrl ? { thumbnail: coverUrl, smallThumbnail: coverUrl } : undefined,
              industryIdentifiers: item.isbn?.[0] ? [{ type: "ISBN_13", identifier: item.isbn[0] }] : (cleanIsbn ? [{ type: "ISBN_13", identifier: cleanIsbn }] : undefined),
            },
          };
        }),
      };

      searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL, payload: fallbackPayload });
      return Response.json(fallbackPayload);
    }
  } catch {
    // If Open Library network fails
  }

  // If query is an ISBN and search services failed, provide single direct ISBN item
  if (cleanIsbn) {
    const directPayload = {
      items: [
        {
          id: `isbn-${cleanIsbn}`,
          volumeInfo: {
            title: `ISBN ${cleanIsbn}`,
            authors: ["Unknown Author"],
            imageLinks: {
              thumbnail: `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`,
            },
            industryIdentifiers: [{ type: "ISBN_13", identifier: cleanIsbn }],
          },
        },
      ],
    };
    return Response.json(directPayload);
  }

  return Response.json({ items: [] });
}