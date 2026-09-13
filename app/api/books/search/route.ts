import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return Response.json({ items: [] });
  }

  const normalizedIsbn = query
    .replace(/^isbn[:\s]*/i, "")
    .replace(/[\s-]/g, "");
  const isIsbn = /^(?:\d{9}[\dXx]|\d{13})$/.test(normalizedIsbn);
  const searchQuery = isIsbn ? `isbn:${normalizedIsbn.toUpperCase()}` : query;

  const googleBooksUrl = new URL("https://www.googleapis.com/books/v1/volumes");
  googleBooksUrl.searchParams.set("q", searchQuery);
  googleBooksUrl.searchParams.set("maxResults", "6");
  googleBooksUrl.searchParams.set("printType", "books");

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    googleBooksUrl.searchParams.set("key", apiKey);
  }

  const response = await fetch(googleBooksUrl, { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    return Response.json(
      { error: payload.error?.message ?? "Google Books search is unavailable." },
      { status: response.status },
    );
  }

  return Response.json(payload);
}