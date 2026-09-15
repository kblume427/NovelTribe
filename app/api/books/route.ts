import { starterBooks } from "@/lib/recommendations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeCoverUrl, resolveCoverUrl } from "@/lib/covers";

async function recordActivity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  bookId: string,
  title: string,
  author: string,
  eventType: "started" | "finished" | "rated",
  rating?: number,
  coverUrl?: string | null,
) {
  await supabase.from("reading_activity").insert({
    user_id: userId,
    book_id: bookId,
    title,
    author,
    event_type: eventType,
    rating: rating ?? null,
    cover_url: coverUrl ?? null,
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

  // If upsert is requested, check if a matching book already exists for this user
  if (payload.upsert) {
    let existingBookQuery = supabase
      .from("books")
      .select("id, status, rating, review, isbn, format, quotes, mood_tags, custom_shelves, total_pages, current_page, finished_at, cover_url")
      .eq("user_id", user.id);

    // Prefer matching on clean ISBN if provided, else match on title and author (case-insensitive)
    const cleanIsbn = payload.isbn ? String(payload.isbn).trim() : null;
    let matchedBook = null;

    if (cleanIsbn) {
      const { data: isbnMatches } = await existingBookQuery.eq("isbn", cleanIsbn).limit(1);
      if (isbnMatches && isbnMatches.length > 0) {
        matchedBook = isbnMatches[0];
      }
    }

    if (!matchedBook && payload.title && payload.author) {
      const { data: titleAuthorMatches } = await supabase
        .from("books")
        .select("id, status, rating, review, isbn, format, quotes, mood_tags, custom_shelves, total_pages, current_page, finished_at, cover_url")
        .eq("user_id", user.id)
        .ilike("title", String(payload.title).trim())
        .ilike("author", String(payload.author).trim())
        .limit(1);

      if (titleAuthorMatches && titleAuthorMatches.length > 0) {
        matchedBook = titleAuthorMatches[0];
      }
    }

    if (matchedBook) {
      // Merge / update existing entry
      const updateData: Record<string, unknown> = {};

      if (payload.status && payload.status !== matchedBook.status) {
        updateData.status = payload.status;
        if (payload.status === "Read" && !matchedBook.finished_at) {
          updateData.finished_at = payload.finished_at || new Date().toISOString();
        }
      }
      if (payload.rating !== undefined && payload.rating !== null && payload.rating > 0 && matchedBook.rating === 0) {
        updateData.rating = payload.rating;
      }
      if (payload.review && !matchedBook.review) {
        updateData.review = payload.review.trim().slice(0, 1000);
      }
      if (payload.isbn && !matchedBook.isbn) {
        updateData.isbn = payload.isbn;
      }
      if (payload.format && !matchedBook.format) {
        updateData.format = payload.format;
      }
      if (Array.isArray(payload.custom_shelves) && payload.custom_shelves.length > 0) {
        const mergedShelves = Array.from(new Set([...(matchedBook.custom_shelves || []), ...payload.custom_shelves]));
        updateData.custom_shelves = mergedShelves;
      }
      if (Array.isArray(payload.mood_tags) && payload.mood_tags.length > 0) {
        const mergedMoods = Array.from(new Set([...(matchedBook.mood_tags || []), ...payload.mood_tags]));
        updateData.mood_tags = mergedMoods;
      }
      if (Array.isArray(payload.quotes) && payload.quotes.length > 0) {
        const existingQuotes = matchedBook.quotes || [];
        const combinedQuotes = [...existingQuotes, ...payload.quotes.filter((q: string) => !existingQuotes.includes(q))];
        updateData.quotes = combinedQuotes;
      }
      if (payload.total_pages && !matchedBook.total_pages) {
        updateData.total_pages = Number(payload.total_pages);
      }
      if (payload.current_page && !matchedBook.current_page) {
        updateData.current_page = Number(payload.current_page);
      }
      if (!matchedBook.cover_url) {
        if (payload.cover_url) {
          updateData.cover_url = sanitizeCoverUrl(payload.cover_url);
        } else {
          const autoCover = await resolveCoverUrl({
            isbn: payload.isbn || matchedBook.isbn,
            title: payload.title,
            author: payload.author,
          });
          if (autoCover) updateData.cover_url = autoCover;
        }
      }

      // If there are fields to update, apply them
      if (Object.keys(updateData).length > 0) {
        const { data: updated, error: updateError } = await supabase
          .from("books")
          .update(updateData)
          .eq("id", matchedBook.id)
          .select()
          .single();

        if (!updateError && updated) {
          return Response.json({ ok: true, book: updated, updated: true });
        }
      }

      return Response.json({ ok: true, book: matchedBook, updated: false, alreadyExisted: true });
    }
  }

  let finalCoverUrl = sanitizeCoverUrl(payload.cover_url);
  if (!finalCoverUrl) {
    finalCoverUrl = await resolveCoverUrl({
      isbn: payload.isbn,
      title: payload.title,
      author: payload.author,
    });
  }

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
      mood_tags: Array.isArray(payload.mood_tags) ? payload.mood_tags : null,
      quotes: Array.isArray(payload.quotes) ? payload.quotes : null,
      format: payload.format ?? null,
      audiobook_narrator: payload.audiobook_narrator ?? null,
      audiobook_duration: payload.audiobook_duration ?? null,
      custom_shelves: Array.isArray(payload.custom_shelves) ? payload.custom_shelves : null,
      total_pages: payload.total_pages !== undefined && payload.total_pages !== null && payload.total_pages !== "" ? Number(payload.total_pages) : null,
      current_page: payload.current_page !== undefined && payload.current_page !== null && payload.current_page !== "" ? Number(payload.current_page) : null,
      categories: payload.categories ?? [payload.genre],
      review: payload.review?.trim().slice(0, 1000) || null,
      cover_url: finalCoverUrl ?? null,
      finished_at: payload.status === "Read" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (!error && data) {
    if (data.status === "Currently Reading" || data.status === "Read") {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, data.status === "Read" ? "finished" : "started", undefined, data.cover_url);
    }
    if (data.rating > 0) {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "rated", data.rating, data.cover_url);
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
    .select("status, finished_at, isbn, categories, rating, review, cover_url, mood_tags, quotes, format, audiobook_narrator, audiobook_duration, custom_shelves, total_pages, current_page")
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
      mood_tags: Array.isArray(payload.mood_tags) ? payload.mood_tags : existingBook.mood_tags ?? null,
      quotes: Array.isArray(payload.quotes) ? payload.quotes : existingBook.quotes ?? null,
      format: payload.format !== undefined ? payload.format : existingBook.format ?? null,
      audiobook_narrator: payload.audiobook_narrator !== undefined ? payload.audiobook_narrator : existingBook.audiobook_narrator ?? null,
      audiobook_duration: payload.audiobook_duration !== undefined ? payload.audiobook_duration : existingBook.audiobook_duration ?? null,
      custom_shelves: Array.isArray(payload.custom_shelves) ? payload.custom_shelves : existingBook.custom_shelves ?? null,
      total_pages: payload.total_pages !== undefined ? (payload.total_pages !== null && payload.total_pages !== "" ? Number(payload.total_pages) : null) : existingBook.total_pages ?? null,
      current_page: payload.current_page !== undefined ? (payload.current_page !== null && payload.current_page !== "" ? Number(payload.current_page) : null) : existingBook.current_page ?? null,
      isbn: payload.isbn ?? existingBook.isbn ?? null,
      categories: payload.categories ?? existingBook.categories ?? [payload.genre],
      review: payload.review?.trim().slice(0, 1000) || null,
      cover_url: payload.cover_url !== undefined ? sanitizeCoverUrl(payload.cover_url) : (existingBook.cover_url ?? null),
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
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "started", undefined, data.cover_url);
    }
    if (existingBook.status !== data.status && data.status === "Read") {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "finished", undefined, data.cover_url);
    }
    if (Number(existingBook.rating ?? 0) !== Number(data.rating ?? 0) && data.rating > 0) {
      await recordActivity(supabase, user.id, data.id, data.title, data.author, "rated", data.rating, data.cover_url);
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
