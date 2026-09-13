import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ activity: [] }, { status: 401 });

  const { data, error } = await supabase
    .from("reading_activity")
    .select("id, user_id, title, author, event_type, rating, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return Response.json({ activity: [] });
  return Response.json({ activity: data ?? [] });
}
