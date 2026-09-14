import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateStreak, type ReadingSession } from "@/lib/sessions";

export type { ReadingSession };
export { calculateStreak };

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ ok: false, error: "Not authenticated", sessions: [], streak: 0 }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get("book_id");

  let query = supabase
    .from("reading_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (bookId) {
    query = query.eq("book_id", bookId);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ ok: false, error: error.message, sessions: [], streak: 0 }, { status: 500 });
  }

  const sessions = (data ?? []) as ReadingSession[];
  const streak = calculateStreak(sessions.map((s) => s.session_date));
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const totalPages = sessions.reduce((sum, s) => sum + (s.pages_read ?? 0), 0);

  return Response.json({
    ok: true,
    sessions,
    streak,
    totalMinutes,
    totalPages,
  });
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

  const duration = payload.duration_minutes ? Math.max(1, parseInt(payload.duration_minutes, 10)) : null;
  const pages = payload.pages_read !== undefined && payload.pages_read !== null && payload.pages_read !== ""
    ? Math.max(0, parseInt(payload.pages_read, 10))
    : null;
  const sessionDate = payload.session_date ? String(payload.session_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const notes = payload.notes?.trim() ? String(payload.notes).trim().slice(0, 1000) : null;

  const { data, error } = await supabase
    .from("reading_sessions")
    .insert({
      user_id: user.id,
      book_id: payload.book_id || null,
      duration_minutes: duration,
      pages_read: pages,
      notes,
      session_date: sessionDate,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, session: data });
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
  const sessionId = payload.id;

  if (!sessionId) {
    return Response.json({ ok: false, error: "Missing session id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("reading_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
