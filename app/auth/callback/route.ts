import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
  const callbackOrigin = origin;
  const useCanonicalCookie = new URL(origin).hostname.endsWith("novel-tribe.com");

  if (code) {
    const response = NextResponse.redirect(`${callbackOrigin}${next}`, { status: 303 });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
                  response.cookies.set(name, value, useCanonicalCookie
                    ? { ...options, domain: ".novel-tribe.com", secure: true, sameSite: "lax" }
                    : options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(`${callbackOrigin}/login?error=auth`);
}
