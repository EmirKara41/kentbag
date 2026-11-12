import type { Pool, PoolClient } from "pg";

export type Row = Record<string, any>;
export type Db = {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
  /** Runs fn inside one transaction; fn must use the Db it receives. */
  tx<T>(fn: (q: Db) => Promise<T>): Promise<T>;
};

function clientDb(client: PoolClient): Db {
  const self: Db = {
    query: (text, params) => client.query(text, params as unknown[]),
    tx: (fn) => fn(self),
  };
  return self;
}

const RETRYABLE = new Set(["40P01", "40001"]); // deadlock, serialization failure

export function createPgDb(pool: Pool): Db {
  async function once<T>(fn: (q: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await fn(clientDb(client));
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
  }
  return {
    query: (text, params) => pool.query(text, params as unknown[]),
    async tx(fn) {
      for (let attempt = 1; ; attempt++) {
        try {
          return await once(fn);
        } catch (error) {
          if (attempt >= 3 || !RETRYABLE.has((error as { code?: string })?.code ?? "")) throw error;
        }
      }
    },
  };
}
