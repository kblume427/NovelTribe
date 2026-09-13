import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return Response.json({ items: [] });
  }

  const googleBooksUrl = new URL("https://www.googleapis.com/books/v1/volumes");
  googleBooksUrl.searchParams.set("q", query);
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