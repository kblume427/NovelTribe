import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ profiles: [] }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") === "followers" ? "followers" : "following";
  const column = type === "followers" ? "follower_id" : "following_id";
  const { data: rows } = await supabase.from("follows").select("follower_id, following_id").eq(type === "followers" ? "following_id" : "follower_id", user.id);
  const ids = (rows ?? []).map((row) => row[column]);
  if (ids.length === 0) return Response.json({ profiles: [] });

  const { data: profiles } = await supabase.from("profiles").select("username, full_name, avatar_url, preferred_categories").in("id", ids).eq("is_public", true);
  return Response.json({ profiles: profiles ?? [] });
}
