import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReadingSession = {
  id: string;
  user_id: string;
  book_id: string | null;
  duration_minutes: number | null;
  pages_read: number | null;
  notes: string | null;
  session_date: string;
  created_at: string;
};

export function calculateStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const uniqueDates = Array.from(new Set(dates.map((d) => d.slice(0, 10)))).sort().reverse();
  if (!uniqueDates.length) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const mostRecent = uniqueDates[0];
  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0;
  }

  let streak = 0;
  let expectedTime = new Date(mostRecent + "T00:00:00Z").getTime();

  for (const dateStr of uniqueDates) {
    const curTime = new Date(dateStr + "T00:00:00Z").getTime();
    const diffDays = Math.round((expectedTime - curTime) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      streak++;
      expectedTime = curTime - 86400000;
    } else {
      break;
    }
  }

  return streak;
}

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
