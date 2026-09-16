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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    access_token?: string;
    refresh_token?: string;
  } | null;

  if (!body?.access_token || !body.refresh_token) {
    return Response.json({ error: "Missing session tokens" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });

  if (error || !data.session) {
    return Response.json({ error: "Could not synchronize session" }, { status: 401 });
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
