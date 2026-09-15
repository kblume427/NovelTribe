import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ profiles: [] });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const matchPattern = `%${query.replace(/[%_]/g, "\\$&")}%`;

  let profileQuery = supabase
    .from("profiles")
    .select("username, full_name, avatar_url, preferred_categories")
    .eq("is_public", true)
    .or(`username.ilike.${matchPattern},full_name.ilike.${matchPattern}`)
    .order("username", { ascending: true })
    .limit(20);

  if (user) {
    profileQuery = profileQuery.neq("id", user.id);
  }

  const { data, error } = await profileQuery;
  if (error) return Response.json({ profiles: [] }, { status: 503 });

  return Response.json({ profiles: data ?? [] });
}
