/**
 * Runs the Supabase schema by calling the REST API with service role key.
 * Supabase doesn't expose raw SQL via REST, so we use individual table-check
 * queries and report what's missing. The actual schema must be run manually
 * in the Supabase SQL editor using supabase-schema.sql.
 * 
 * This script validates the DB state and reports missing tables.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const tables = [
  "locations",
  "tracked_satellites", 
  "groups",
  "group_members",
  "alert_subscriptions",
  "sent_alerts",
];

console.log(`\nChecking Supabase project: ${SUPABASE_URL}\n`);

let allExist = true;
for (const table of tables) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    }
  });
  
  if (res.ok || res.status === 406) {
    console.log(`  ✓ ${table}`);
  } else {
    const body = await res.json().catch(() => ({}));
    if (body.code === "42P01" || body.message?.includes("does not exist")) {
      console.log(`  ✗ ${table} — MISSING`);
      allExist = false;
    } else {
      console.log(`  ? ${table} — status ${res.status}: ${JSON.stringify(body).slice(0, 100)}`);
      allExist = false;
    }
  }
}

if (!allExist) {
  console.log(`
⚠️  Some tables are missing. To create them:
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Paste and run the contents of: artifacts/satellite-tracker/supabase-schema.sql
`);
} else {
  console.log("\n✅ All tables exist!\n");
}
