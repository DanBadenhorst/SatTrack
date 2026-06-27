import { createBrowserClient } from "@supabase/ssr";

function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.replace(/\/rest\/v1\/?$/, "");
}

export function createClient() {
  return createBrowserClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
