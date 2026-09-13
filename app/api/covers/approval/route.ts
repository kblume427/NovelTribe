import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const isbn = new URL(request.url).searchParams.get("isbn")?.trim();
  if (!isbn) return Response.json({ approved: false });

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("cover_approvals").select("cover_url").eq("isbn", isbn).maybeSingle();
  return Response.json({ approved: Boolean(data), cover_url: data?.cover_url ?? null });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { isbn, cover_url } = (await request.json()) as { isbn?: string; cover_url?: string };
  if (!isbn || !cover_url) return Response.json({ error: "ISBN and cover URL are required" }, { status: 400 });

  const { error } = await supabase.from("cover_approvals").upsert(
    { isbn: isbn.trim(), cover_url: cover_url.trim(), approved_by: user.id },
    { onConflict: "isbn" },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ approved: true, cover_url });
}
