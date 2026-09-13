import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/server";

export async function GET() {
  const sessionClient = await createSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || !supabaseAdmin) return Response.json({ error: "Not available" }, { status: 404 });

  const { data: profile } = await sessionClient
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const allowedUsers = (process.env.PRIVATE_STATS_USERNAMES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!profile?.username || !allowedUsers.includes(profile.username.toLowerCase())) {
    return Response.json({ error: "Not available" }, { status: 404 });
  }

  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) return Response.json({ error: "Count unavailable" }, { status: 503 });

  return Response.json({ totalUsers: count ?? 0 });
}
