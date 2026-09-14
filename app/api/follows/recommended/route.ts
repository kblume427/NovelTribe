import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureEnabled, resolveFeatureFlags } from "@/lib/featureFlags";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ profiles: [] }, { status: 401 });

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("feature_flags, preferred_categories")
    .eq("id", user.id)
    .maybeSingle();

  const flags = resolveFeatureFlags(userProfile?.feature_flags);
  const strictMatch = isFeatureEnabled(flags, "strict_peer_genre_match");
  const userCategories = new Set(
    (userProfile?.preferred_categories ?? []).map((c: string) => c.toLowerCase()),
  );

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
    .limit(24);

  if (error || !data) return Response.json({ profiles: [] });

  let result = data;
  if (strictMatch && userCategories.size > 0) {
    result = data
      .map((profile) => {
        const peerCategories = (profile.preferred_categories ?? []).map((c: string) => c.toLowerCase());
        const overlap = peerCategories.filter((c: string) => userCategories.has(c)).length;
        return { profile, overlap };
      })
      .filter(({ overlap }) => overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .map(({ profile }) => profile);
  }

  return Response.json({ profiles: result.slice(0, 6) });
}
