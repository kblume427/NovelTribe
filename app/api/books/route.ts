import { starterBooks } from "@/lib/recommendations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    })
    .select()
    .single();

  if (!error && data) {
    return Response.json({ ok: true, book: data });
  }

  return Response.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
}
