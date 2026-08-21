import { pool, withTransaction } from "./db.js";
import { migrate } from "./migrate.js";

await migrate();
const result = await withTransaction(async (client) => {
  const users = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days' FOR UPDATE`,
  );
  for (const user of users.rows) {
    await client.query("DELETE FROM workspaces WHERE owner_id = $1", [user.id]);
    await client.query("DELETE FROM users WHERE id = $1", [user.id]);
  }
  return users.rowCount ?? 0;
});
console.log(`Comptes purgés: ${result}`);
await pool.end();
