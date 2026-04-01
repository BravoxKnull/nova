import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __novaDashboardPool: Pool | undefined;
}

function readDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("Missing required dashboard environment variable: DATABASE_URL");
  }

  return value;
}

export function getDashboardPool(): Pool {
  if (!global.__novaDashboardPool) {
    global.__novaDashboardPool = new Pool({
      connectionString: readDatabaseUrl(),
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }

  return global.__novaDashboardPool;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDashboardPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getDashboardPool().query<T>(sql, values);
}
