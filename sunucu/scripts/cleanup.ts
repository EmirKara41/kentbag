import { Pool } from "pg";
import { configFromEnv } from "../src/config.js";
import { privateBlob } from "../src/storage.js";
const pool = new Pool({
  connectionString: configFromEnv(process.env).databaseUrl,
  max: 1,
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    "SELECT id,pathname FROM citizen_photo WHERE report_id IS NULL AND created_at < now() - interval '1 day' FOR UPDATE SKIP LOCKED LIMIT 100",
  );
  for (const row of rows) {
    await privateBlob.del(row.pathname);
    await client.query(
      "DELETE FROM citizen_photo WHERE id=$1 AND report_id IS NULL",
      [row.id],
    );
  }
  await client.query("COMMIT");
  console.log(`Removed ${rows.length} expired, unattached uploads.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
