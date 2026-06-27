/**
 * Apply Supabase schema using direct postgres connection.
 * Connection string format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 * 
 * Usage: SUPABASE_DB_URL="..." node scripts/apply-schema.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("❌ Set SUPABASE_DB_URL to your Supabase connection string");
  console.error("   Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres");
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: "require", max: 1 });
const schemaFile = join(__dirname, "..", "supabase-schema.sql");
const schemaSql = readFileSync(schemaFile, "utf-8");

// Split on semicolons but keep PL/pgSQL blocks together
const statements = schemaSql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));

console.log(`\nApplying ${statements.length} SQL statements...\n`);

let ok = 0, fail = 0;
for (const stmt of statements) {
  try {
    await sql.unsafe(stmt + ";");
    const label = stmt.slice(0, 60).replace(/\s+/g, " ");
    console.log(`  ✓ ${label}...`);
    ok++;
  } catch (e) {
    const label = stmt.slice(0, 60).replace(/\s+/g, " ");
    if (e.code === "42710" || e.message?.includes("already exists")) {
      console.log(`  ~ ${label}... (already exists, skipped)`);
      ok++;
    } else {
      console.error(`  ✗ ${label}...`);
      console.error(`    ${e.message}`);
      fail++;
    }
  }
}

await sql.end();
console.log(`\n${ok} succeeded, ${fail} failed\n`);
if (fail > 0) process.exit(1);
