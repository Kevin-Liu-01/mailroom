import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __mailroomSql: ReturnType<typeof postgres> | undefined;
}

function connection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Reuse the connection across hot reloads and warm serverless invocations.
  if (!globalThis.__mailroomSql) {
    globalThis.__mailroomSql = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
  }
  return globalThis.__mailroomSql;
}

export const db = drizzle(connection(), { schema });
export { schema };
