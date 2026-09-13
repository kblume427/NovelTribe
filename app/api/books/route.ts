import { starterBooks } from "@/lib/recommendations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function recordActivity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  bookId: string,
  title: string,
  author: string,
  eventType: "started" | "finished" | "rated",
  rating?: number,
) {
  await supabase.from("reading_activity").insert({
    user_id: userId,
    book_id: bookId,
    title,
    author,
    event_type: eventType,
    rating: rating ?? null,
  });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ books: starterBooks });
  }

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!error && data) {
    return Response.json({ books: data });
  }

  return Response.json({ books: starterBooks });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const payload = await request.json();

  const { data, error } = await supabase
    .from("books")
    .insert({
      user_id: user.id,
      title: payload.title,
      author: payload.author,
      genre: payload.genre,
      status: payload.status,
      rating: payload.rating,
      isbn: payload.isbn ?? null,
      categories: payload.categories ?? [payload.genre],
      review: payload.review?.trim().slice(0, 1000) || null,
      finished_at: payload.status === "Read" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (!error && data) {
    if (data.status === "Currently Reading" || data.status === "Read") {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, data.status === "Read" ? "finished" : "started");
    }
    if (data.rating > 0) {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "rated", data.rating);
    }
    return Response.json({ ok: true, book: data });
  }

  return Response.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const payload = await request.json();
  const bookId = payload.id;

  if (!bookId) {
    return Response.json({ ok: false, error: "Missing book id" }, { status: 400 });
  }

  const { data: existingBook, error: existingBookError } = await supabase
    .from("books")
    .select("status, finished_at, isbn, categories, rating, review")
    .eq("id", bookId)
    .eq("user_id", user.id)
    .single();

  if (existingBookError || !existingBook) {
    return Response.json({ ok: false, error: "Book not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("books")
    .update({
      title: payload.title,
      author: payload.author,
      genre: payload.genre,
      status: payload.status,
      rating: payload.rating,
      isbn: payload.isbn ?? existingBook.isbn ?? null,
      categories: payload.categories ?? existingBook.categories ?? [payload.genre],
      review: payload.review?.trim().slice(0, 1000) || null,
      finished_at:
        payload.status === "Read"
          ? existingBook.status === "Read" && existingBook.finished_at
            ? existingBook.finished_at
            : new Date().toISOString()
          : null,
    })
    .eq("id", bookId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (!error && data) {
    if (existingBook.status !== data.status && data.status === "Currently Reading") {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "started");
    }
    if (existingBook.status !== data.status && data.status === "Read") {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "finished");
    }
    if (Number(existingBook.rating ?? 0) !== Number(data.rating ?? 0) && data.rating > 0) {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "rated", data.rating);
    }
    return Response.json({ ok: true, book: data });
  }

  return Response.json({ ok: false, error: error?.message ?? "Update failed" }, { status: 500 });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const payload = await request.json();
  const bookId = payload.id;

  if (!bookId) {
    return Response.json({ ok: false, error: "Missing book id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("user_id", user.id);

  if (!error) {
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: error.message }, { status: 500 });
}
