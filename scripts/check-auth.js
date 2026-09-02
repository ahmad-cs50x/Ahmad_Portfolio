/**
 * Auth doctor — verifies everything sign-in depends on, in order.
 *
 *   node scripts/check-auth.js
 *
 * Checks:
 *   1. Required env vars are present (values are never printed)
 *   2. Supabase is reachable at all (so a dead connection isn't misread
 *      as six missing tables)
 *   3. The four Auth.js tables + app tables exist and are readable
 *   4. Service-role WRITES actually land (insert -> read -> delete round-trip)
 *   5. SMTP credentials authenticate (magic-link delivery)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

const AUTH_TABLES = ["users", "accounts", "sessions", "verification_tokens"];
const APP_TABLES = ["profiles", "clients"];
const PLACEHOLDER_SECRETS = [
  "dev-only-insecure-secret-change-me",
  "run-this-to-generate-one--openssl-rand-base64-32",
];

let failures = 0;
let warnings = 0;

const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
};
const warn = (msg) => {
  warnings++;
  console.log(`  \x1b[33m!\x1b[0m ${msg}`);
};
const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);

/**
 * Classifies a Supabase/PostgREST failure.
 *
 * This exists because "TypeError: fetch failed" (no network) used to be
 * reported as `table "users" is MISSING`, which sends you off applying a
 * migration that was already applied. Network, auth-key, RLS and
 * genuinely-missing-table failures all need different fixes.
 */
function classify(error) {
  const raw = error?.message || String(error);

  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|network|timeout/i.test(raw)) {
    return {
      kind: "network",
      hint: "Cannot reach Supabase at all. Check your internet connection, NEXT_PUBLIC_SUPABASE_URL, and whether the Supabase project is paused (free projects pause after inactivity).",
    };
  }
  if (/invalid api key|invalid jwt|jwt|401|unauthorized/i.test(raw)) {
    return {
      kind: "key",
      hint: "Supabase rejected the API key. Re-copy SUPABASE_SERVICE_ROLE_KEY from Project Settings → API (no quotes, no trailing spaces).",
    };
  }
  if (/row-level security|permission denied/i.test(raw)) {
    return {
      kind: "rls",
      hint: "Blocked by row-level security — you are using the anon key, not the service_role key.",
    };
  }
  if (/does not exist|schema cache|not find the table/i.test(raw)) {
    return {
      kind: "missing",
      hint: "Table does not exist. Apply the migration with: npm run db:migrate",
    };
  }
  return { kind: "unknown", hint: null };
}

/**
 * One cheap request before anything else, so a dead connection is reported
 * once as a connection problem instead of six times as missing tables.
 */
async function checkReachable(sb) {
  section("2. Supabase is reachable");
  const { error } = await sb.from("users").select("id", { count: "exact", head: true });
  if (!error) {
    ok("Supabase responded");
    return true;
  }
  const { kind, hint } = classify(error);
  if (kind === "network" || kind === "key") {
    bad(`Cannot query Supabase: ${error.message}`);
    if (hint) console.log(`    → ${hint}`);
    return false;
  }
  // Reachable — it answered, even if the answer was "no such table".
  ok("Supabase responded");
  return true;
}

function checkEnv() {
  section("1. Environment variables");

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXTAUTH_URL",
    "AUTH_SECRET",
  ];

  for (const key of required) {
    const value = process.env[key];
    if (!value || !value.trim()) bad(`${key} is missing or empty`);
    else ok(`${key} is set`);
  }

  const secret = (process.env.AUTH_SECRET || "").trim();
  if (secret && PLACEHOLDER_SECRETS.includes(secret)) {
    warn("AUTH_SECRET is still the placeholder — run: openssl rand -base64 32");
  }

  // A trailing space here silently breaks Google's token exchange.
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const raw = process.env[key];
    if (raw && raw !== raw.trim()) bad(`${key} has leading/trailing whitespace — remove it`);
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    if (!process.env.GOOGLE_CLIENT_ID.trim().endsWith(".apps.googleusercontent.com")) {
      warn("GOOGLE_CLIENT_ID doesn't look like a Google client ID");
    } else {
      ok("Google OAuth credentials present");
    }
    const url = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
    console.log(
      `    → Google Console redirect URI must be exactly: ${url}/api/auth/callback/google`
    );
  } else {
    warn("Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER) ok("SMTP credentials present");
  else warn("SMTP not configured — email magic links will be disabled");
}

async function checkTables(sb) {
  section("3. Auth.js tables exist and are readable");

  const missing = [];

  for (const table of [...AUTH_TABLES, ...APP_TABLES]) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) {
      const { kind, hint } = classify(error);
      if (kind === "missing") missing.push(table);
      bad(`table "${table}" — ${error.message}`);
      if (hint) console.log(`    → ${hint}`);
    } else {
      ok(`${table} — ${count} row(s)`);
    }
  }

  return missing;
}

async function checkWrites(sb) {
  section("4. Service-role writes land (insert → read → delete)");

  const id = randomUUID();
  const email = `authdoctor+${id.slice(0, 8)}@example.invalid`;

  const { error: insertError } = await sb
    .from("users")
    .insert({ id, email, name: "auth doctor", emailVerified: new Date().toISOString() });
  if (insertError) {
    const { hint } = classify(insertError);
    bad(`INSERT into users failed: ${insertError.message}`);
    if (hint) console.log(`    → ${hint}`);
    return;
  }
  ok("insert into users succeeded");

  const { data, error: readError } = await sb
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError || !data) bad(`read-back failed: ${readError?.message ?? "row not found"}`);
  else ok("read-back returned the row (auth info does persist)");

  // Session round-trip — this is the table sign-in writes to last.
  const sessionToken = `authdoctor-${randomUUID()}`;
  const { error: sessionError } = await sb.from("sessions").insert({
    id: randomUUID(),
    sessionToken,
    user_id: id,
    expires: new Date(Date.now() + 60_000).toISOString(),
  });
  if (sessionError) bad(`INSERT into sessions failed: ${sessionError.message}`);
  else ok("insert into sessions succeeded");

  await sb.from("sessions").delete().eq("sessionToken", sessionToken);
  const { error: cleanupError } = await sb.from("users").delete().eq("id", id);
  if (cleanupError) warn(`cleanup failed, remove user ${id} manually: ${cleanupError.message}`);
  else ok("cleanup complete (no test rows left behind)");
}

async function checkSmtp() {
  section("5. SMTP login");

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    warn("skipped — SMTP not configured");
    return;
  }

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    warn("skipped — nodemailer not installed");
    return;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transport.verify();
    ok(`SMTP authenticated (${process.env.SMTP_HOST}:${port})`);
  } catch (error) {
    bad(`SMTP failed: ${error.message}`);
    if (/invalid login|username and password/i.test(error.message)) {
      console.log("    → For Gmail you need a 16-char App Password, not your account password.");
    }
  }
}

async function main() {
  console.log("\n\x1b[1mAuth doctor\x1b[0m — checking sign-in prerequisites");

  checkEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log("\n\x1b[31mCannot reach Supabase without URL + service-role key. Stopping.\x1b[0m\n");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const reachable = await checkReachable(sb);
  if (!reachable) {
    section("Summary");
    console.log(
      `  \x1b[31mCannot reach Supabase — stopping.\x1b[0m Everything below depends on it.`
    );
    console.log(
      `  This is a connection/credential problem, NOT a missing migration. Fix the hint above first.\n`
    );
    process.exit(1);
  }

  const missingTables = await checkTables(sb);

  if (missingTables.length) {
    console.log(
      `\n  \x1b[33m${missingTables.length} table(s) missing:\x1b[0m ${missingTables.join(", ")}`
    );
    console.log("  Apply the schema with:  npm run db:migrate");
    console.log("  (skipping write test until the tables exist)");
  } else if (!failures) {
    await checkWrites(sb);
  } else {
    console.log("\n  (skipping write test — resolve the errors above first)");
  }

  await checkSmtp();

  section("Summary");
  if (failures) {
    console.log(`  \x1b[31m${failures} problem(s)\x1b[0m, ${warnings} warning(s)\n`);
    process.exit(1);
  }
  console.log(`  \x1b[32mAll checks passed\x1b[0m, ${warnings} warning(s)`);
  console.log("  Auth storage is healthy — start the app with: npm run dev\n");
}

main().catch((error) => {
  console.error("\nauth doctor crashed:", error.message);
  process.exit(1);
});
