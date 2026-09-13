import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ profiles: [] }, { status: 401 });

  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const excludedIds = [user.id, ...(follows ?? []).map((follow) => follow.following_id)];

  const { data, error } = await supabase
    .from("profiles")
    .select("username, full_name, avatar_url, preferred_categories")
    .eq("is_public", true)
    .not("username", "is", null)
    .not("id", "in", `(${excludedIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) return Response.json({ profiles: [] });
  return Response.json({ profiles: data ?? [] });
}
