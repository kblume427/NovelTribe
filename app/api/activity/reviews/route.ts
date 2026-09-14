import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ reviews: [] }, { status: 401 });

  const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
  const followingIds = (follows ?? []).map((follow) => follow.following_id);
  if (followingIds.length === 0) return Response.json({ reviews: [] });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, public_library, public_reviews, public_ratings")
    .in("id", followingIds)
    .eq("is_public", true)
    .eq("public_reviews", true);
  const eligibleProfiles = profiles ?? [];
  const eligibleIds = eligibleProfiles.map((profile) => profile.id);
  if (eligibleIds.length === 0) return Response.json({ reviews: [] });

  const { data: books } = await supabase
    .from("books")
    .select("title, author, genre, categories, cover_url, rating, review, user_id")
    .in("user_id", eligibleIds)
    .not("review", "is", null)
    .neq("review", "")
    .gte("rating", 1)
    .order("rating", { ascending: false })
    .limit(24);

  const profileById = new Map(eligibleProfiles.map((profile) => [profile.id, profile]));
  const reviews = (books ?? []).map((book) => {
    const profile = profileById.get(book.user_id);
    return {
      title: book.title,
      author: book.author,
      genre: book.genre,
      categories: book.categories,
      cover_url: book.cover_url,
      rating: profile?.public_ratings ? book.rating : null,
      review: book.review,
      reviewer: profile?.full_name || `@${profile?.username}`,
      username: profile?.username,
    };
  });

  return Response.json({ reviews });
}
