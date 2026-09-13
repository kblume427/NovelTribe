import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getContext(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const username = request.nextUrl.searchParams.get("username")?.trim();
  return { supabase, user, username };
}

export async function GET(request: NextRequest) {
  const { supabase, user, username } = await getContext(request);
  if (!user || !username) return Response.json({ following: false }, { status: 401 });

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .eq("is_public", true)
    .maybeSingle();

  if (!target || target.id === user.id) return Response.json({ following: false });

  const { data: follow } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", target.id)
    .maybeSingle();

  return Response.json({ following: Boolean(follow) });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { username } = (await request.json()) as { username?: string };
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username ?? "")
    .eq("is_public", true)
    .maybeSingle();

  if (!target || target.id === user.id) return Response.json({ error: "Profile cannot be followed" }, { status: 400 });

  const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: target.id });
  if (error && error.code !== "23505") return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ following: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { username } = (await request.json()) as { username?: string };
  const { data: target } = await supabase.from("profiles").select("id").ilike("username", username ?? "").maybeSingle();
  if (target) {
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", target.id);
  }
  return Response.json({ following: false });
}
