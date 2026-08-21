import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, withTransaction } from "./db.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(currentDir, "..", "migrations");

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const applied = await pool.query<{ version: string }>(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [file],
    );
    if (applied.rowCount) continue;
    const sql = await readFile(join(migrationsDir, file), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => pool.end()).catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
}
