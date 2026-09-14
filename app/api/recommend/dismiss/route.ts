import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ titles: [] }, { status: 401 });

  const { data } = await supabase.from("recommendation_dismissals").select("title").eq("user_id", user.id);
  return Response.json({ titles: (data ?? []).map((item) => item.title) });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { title } = (await request.json()) as { title?: string };
  if (!title?.trim()) return Response.json({ error: "Title is required" }, { status: 400 });

  const { error } = await supabase.from("recommendation_dismissals").upsert(
    { user_id: user.id, title: title.trim() },
    { onConflict: "user_id,title" },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ dismissed: true });
}
