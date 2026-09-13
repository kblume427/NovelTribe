import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ notifications: [], unread: 0 }, { status: 401 });

  const { data } = await supabase.from("notifications").select("id, type, actor_username, message, read_at, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(20);
  return Response.json({ notifications: data ?? [], unread: (data ?? []).filter((item) => !item.read_at).length });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = (await request.json()) as { id?: string };
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).is("read_at", null);
  if (id) query = query.eq("id", id);
  const { error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
