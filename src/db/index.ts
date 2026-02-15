import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getDb() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Missing POSTGRES_URL or DATABASE_URL environment variable"
    );
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

// Lazy singleton
let db: ReturnType<typeof getDb> | null = null;

export function getDatabase() {
  if (!db) {
    db = getDb();
  }
  return db;
}

export { schema };
