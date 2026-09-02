/**
 * Fully-automated Supabase setup — needs ONLY the database password.
 * Discovers the pooler region, connects, applies migrations + seed, verifies tables.
 *
 * Usage:  set DB_PASSWORD=xxxx && node scripts/setup-db.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("pg");

const REF = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) {
    console.error("Could not read project ref from NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }
  return m[1];
})();

const REGIONS = [
  "ap-southeast-1", "ap-south-1", "ap-northeast-1", "ap-southeast-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "sa-east-1", "ap-northeast-2", "ca-central-1",
];

function probeTcp(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function findRegion() {
  process.stdout.write("Discovering closest Supabase region… ");
  for (const region of REGIONS) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    // eslint-disable-next-line no-await-in-loop
    if (await probeTcp(host, 6543, 3000)) {
      console.log(`${region}`);
      return { host, port: 6543 };
    }
  }
  console.log("none reachable");
  return null;
}

async function main() {
  const password = process.env.DB_PASSWORD;
  if (!password) {
    console.error("Set DB_PASSWORD first:  set DB_PASSWORD=your-db-password && node scripts/setup-db.js");
    process.exit(1);
  }

  const target = await findRegion();
  if (!target) process.exit(1);

  const configs = [
    { host: `db.${REF}.supabase.co`, port: 5432, user: "postgres", ssl: { rejectUnauthorized: false } },
    { host: target.host, port: target.port, user: `postgres.${REF}`, ssl: { rejectUnauthorized: false } },
    { host: target.host, port: 5432, user: `postgres.${REF}`, ssl: { rejectUnauthorized: false } },
  ];

  let client = null;
  let used = null;
  for (const cfg of configs) {
    process.stdout.write(`Trying ${cfg.user}@${cfg.host}:${cfg.port} … `);
    try {
      client = new Client({ ...cfg, connectionString: `postgresql://${encodeURIComponent(cfg.user)}:${encodeURIComponent(password)}@${cfg.host}:${cfg.port}/postgres`, ssl: cfg.ssl });
      // eslint-disable-next-line no-await-in-loop
      await client.connect();
      console.log("connected ✓");
      used = `${cfg.host}:${cfg.port}`;
      break;
    } catch (error) {
      console.log(error.code || error.message || "failed");
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200)).catch(() => {});
      client = null;
    }
  }

  if (!client) {
    console.error("\nAll connection paths failed. Double-check the DB password.");
    process.exit(1);
  }

  try {
    const dir = path.join(__dirname, "..", "supabase", "migrations");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      process.stdout.write(`Applying ${file} … `);
      await client.query(sql);
      console.log("done.");
    }

    const seedPath = path.join(__dirname, "..", "supabase", "seed.sql");
    if (fs.existsSync(seedPath)) {
      process.stdout.write("Applying seed.sql … ");
      await client.query(fs.readFileSync(seedPath, "utf8"));
      console.log("done.");
    }

    const { rows } = await client.query(
      `select table_name from information_schema.tables where table_schema='public' order by table_name`
    );
    console.log(`\nSUCCESS via ${used} — ${rows.length} tables created:`);
    console.log(rows.map((r) => r.table_name).join(", "));
  } catch (error) {
    console.error("\nMigration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
