// Applies every file in db/migrations, in name order, to the database in DATABASE_URL.
// The migrations are written to be safe to run more than once.
//
//   npm run db:migrate            (uses .env.local)
//
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(url);
const dir = join(process.cwd(), "db", "migrations");

for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
  const statements = readFileSync(join(dir, file), "utf8")
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement.replace(/^--.*$/gm, "").trim().length > 0);
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`applied ${file} (${statements.length} statements)`);
}
