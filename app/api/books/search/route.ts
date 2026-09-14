import { NextRequest } from "next/server";

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

  const normalizedIsbn = query
    .replace(/^isbn[:\s]*/i, "")
    .replace(/[\s-]/g, "");
  const isIsbn = /^(?:\d{9}[\dXx]|\d{13})$/.test(normalizedIsbn);
  const isAsin = /^B0[A-Z0-9]{8}$/i.test(query.trim());
  const searchQuery = isIsbn
    ? `isbn:${normalizedIsbn.toUpperCase()}`
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

  const response = await fetch(googleBooksUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  const payload = await response.json();

  if (!response.ok) {
    const openLibraryUrl = new URL("https://openlibrary.org/search.json");
    openLibraryUrl.searchParams.set("q", query);
    openLibraryUrl.searchParams.set("limit", "12");
    openLibraryUrl.searchParams.set("fields", "key,title,author_name,subject,cover_i,isbn");
    const fallbackResponse = await fetch(openLibraryUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!fallbackResponse.ok) return Response.json({ error: payload.error?.message ?? "Book search is unavailable." }, { status: response.status });
    const fallback = await fallbackResponse.json();
    const fallbackPayload = {
      items: (fallback.docs ?? []).map((item: { key?: string; title?: string; author_name?: string[]; subject?: string[]; cover_i?: number; isbn?: string[] }) => ({
        id: item.key ?? item.title,
        volumeInfo: {
          title: item.title,
          authors: item.author_name,
          categories: item.subject?.slice(0, 5),
          imageLinks: item.cover_i ? { thumbnail: `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` } : undefined,
          industryIdentifiers: item.isbn?.[0] ? [{ type: "ISBN_13", identifier: item.isbn[0] }] : undefined,
        },
      })),
    };
    searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL, payload: fallbackPayload });
    return Response.json(fallbackPayload);
  }

  searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL, payload });
  return Response.json(payload);
}