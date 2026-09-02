/**
 * One-shot migration runner: applies supabase/migrations/*.sql + seed.sql
 * to the database referenced by DATABASE_URL (.env.local).
 * Usage: node scripts/run-migrations.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database.");

    const dir = path.join(__dirname, "..", "supabase", "migrations");
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      process.stdout.write(`Applying ${file} … `);
      await client.query(sql);
      console.log("done.");
    }

    const seedPath = path.join(__dirname, "..", "supabase", "seed.sql");
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, "utf8");
      process.stdout.write("Applying seed.sql … ");
      await client.query(seed);
      console.log("done.");
    }

    const { rows } = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`
    );
    console.log(`\nSuccess. ${rows.length} public tables now exist:`);
    console.log(rows.map((r) => r.table_name).join(", "));
  } catch (error) {
    console.error("\nMigration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
