import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { user: { id: user.id, email: user.email ?? null, user_metadata: user.user_metadata ?? {} } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
