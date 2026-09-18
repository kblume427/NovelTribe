import { supabaseAdmin } from "@/lib/server";

export async function GET() {
  if (!supabaseAdmin) return Response.json({ readers: null, books: null });

  const { count: readerCount } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const { data: books } = await supabaseAdmin.from("books").select("title, author, isbn");

  const uniqueBookKeys = new Set(
    (books ?? []).map((book) => {
      const isbn = book.isbn?.replace(/[^0-9X]/gi, "").toUpperCase();
      if (isbn) return `isbn:${isbn}`;
      const title = book.title.trim().replace(/\s+/g, " ").toLowerCase();
      const author = book.author.trim().replace(/\s+/g, " ").toLowerCase();
      return `title-author:${title}:${author}`;
    }),
  );

  return Response.json(
    { readers: readerCount ?? 0, books: uniqueBookKeys.size },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
