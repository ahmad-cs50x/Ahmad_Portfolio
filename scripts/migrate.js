#!/usr/bin/env node
/**
 * Run Supabase migrations via REST API.
 * Usage: npx node scripts/migrate.js up|down|migrate-up|migrate-down
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const action = args[0]?.toLowerCase();

if (!action) {
  console.error("Usage: npx node scripts/migrate.js <up|down|migrate-up|migrate-down>");
  console.error("Commands:");
  console.error("  up           - Run all pending migrations (upward)");
  console.error("  down         - Run one migration downward");
  console.error("  migrate-up   - Alias for up");
  console.error("  migrate-down - Alias for down");
  process.exit(1);
}

const normalized = action.replace(/migrate-/, "");
const up = normalized === "up";
const down = normalized === "down";

const projectPath = path.resolve(__dirname, "../../..");
const dbUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_PASSWORD;

if (!dbUrl || !dbPassword) {
  console.error("Error: SUPABASE_URL and SUPABASE_DB_PASSWORD environment variables are required.");
  process.exit(1);
}

function readSQLFiles() {
  const dir = path.join(projectPath, "supabase", "migrations");
  if (!fs.existsSync(dir)) {
    console.error("No migrations directory found: " + dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  const upFiles = files.filter(f => !f.endsWith(".down.sql"));
  const downFiles = upFiles.map(f => f.replace(".up.sql", ".down.sql")).filter(f => fs.existsSync(path.join(dir, f)));
  return { upFiles, downFiles, dir };
}

function getRunningMigrations(url, password) {
  return fetch(url + "/migrations/run", {
    headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" },
  }).then(r => r.json());
}

async function migrateUp(upFiles) {
  console.log("Running migrations upward:\n");
  const running = await getRunningMigrations(dbUrl, dbPassword);

  for (const file of upFiles) {
    const path = `${file}.up.sql`;
    const full = path.join(__dirname, "..", "..", "supabase", "migrations", path);

    if (running.find(m => m.name === path.replace(".up.sql", ""))) {
      console.log(`✓ ${path} (already applied)`);
      continue;
    }

    console.log(`→ Running ${path}...`);
    const sql = fs.readFileSync(full, "utf-8");

    try {
      // Use the Supabase REST API to run SQL directly
      const res = await fetch(dbUrl + "/sql", {
        method: "POST",
        headers: { Authorization: `Bearer ${dbPassword}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        console.error(`✗ ${path} failed: ${json.detail || json.error}`);
        process.exit(1);
      }
      console.log(`✓ ${path} (success: ${json.msg?.replace(/.*[→→→→|↗|↘|↙|←←|→←|↓|↓↓|↑|↑↑|↙|↗|↘|↖].*/gm, "↗")} `);
    } catch (e) {
      console.error(`✗ ${path} failed: ${e.message}`);
      process.exit(1);
    }
  }
}

async function migrateDown(downFiles) {
  console.log("Running migrations downward:\n");

  const running = await getRunningMigrations(dbUrl, dbPassword);
  const lastMigrated = running[running.length - 1];

  if (!lastMigrated) {
    console.log("No migrations to roll back.");
    return;
  }

  // Find the matching down migration
  const downPath = lastMigrated.name + ".down.sql";
  const downFile = downFiles.find(f => f === downPath.replace(".down.sql", ""));

  if (!downFile) {
    console.error(`No down migration found for ${lastMigrated.name}`);
    process.exit(1);
  }

  const full = path.join(__dirname, "..", "..", "supabase", "migrations", downPath);
  console.log(`→ Running ${downPath}...`);
  const sql = fs.readFileSync(full, "utf-8");

  try {
    const res = await fetch(dbUrl + "/sql", {
      method: "POST",
      headers: { Authorization: `Bearer ${dbPassword}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    });
    const json = await res.json();

    if (!res.ok || json.error) {
      console.error(`✗ ${downPath} failed: ${json.detail || json.error}`);
      process.exit(1);
    }
    console.log(`✓ ${downPath} (success)`);
  } catch (e) {
    console.error(`✗ ${downPath} failed: ${e.message}`);
    process.exit(1);
  }
}

(async () => {
  const { upFiles, downFiles } = readSQLFiles();
  if (up.length === 0 && down.length === 0) {
    console.log("No migrations found.");
    process.exit(0);
  }

  if (up) await migrateUp(upFiles);
  if (down) await migrateDown(downFiles);

  console.log("\nDone ✅");
})();