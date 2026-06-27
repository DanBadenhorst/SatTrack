import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// We'll run each statement via a stored procedure trick:
// Supabase allows calling postgres functions, but for DDL we need
// to use the sql tag via postgrest's rpc endpoint with a helper.
// Instead, we'll check and report table existence via REST.

const tables = [
  "locations",
  "tracked_satellites",
  "groups",
  "group_members",
  "alert_subscriptions",
  "sent_alerts",
];

console.log("Checking Supabase tables...");
for (const table of tables) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (!error) {
    console.log(`✓ ${table} — exists`);
  } else if (error.code === "42P01") {
    console.log(`✗ ${table} — MISSING (run supabase-schema.sql in Supabase SQL editor)`);
  } else {
    console.log(`? ${table} — ${error.code}: ${error.message}`);
  }
}
