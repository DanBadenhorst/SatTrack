import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";

type CookieToSet = { name: string; value: string; options: CookieOptions };

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/rest\/v1\/?$/, "");
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const cookieStore = await cookies();

  const supabase = createServerClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppOrigin(request)}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Auto-sign in after signup (autoconfirm is enabled)
  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) {
    return NextResponse.json({ error: loginError.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
