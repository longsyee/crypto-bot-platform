import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import fs from "node:fs";

const SQL = await initSqlJs();
let dbInstance: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (dbInstance) return dbInstance;

  let dbBuffer: Buffer | undefined;
  if (fs.existsSync("wallet.db")) {
    dbBuffer = fs.readFileSync("wallet.db");
  }

  const sqlDb = new SQL.Database(dbBuffer);

  // Initialize schema if tables don't exist
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS deposit_addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      address_index INTEGER NOT NULL,
      bsc_address TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS blockchain_events (
      id TEXT PRIMARY KEY,
      tx_hash TEXT NOT NULL UNIQUE,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount REAL NOT NULL,
      token_contract TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      confirmations INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      matched_user_id TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      to_address TEXT NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      fee_estimate REAL,
      processed_at INTEGER,
      created_at INTEGER
    );
  `);

  dbInstance = drizzle(sqlDb, { schema });

  // Persist on graceful shutdown
  process.on("SIGINT", () => {
    const data = sqlDb.export();
    fs.writeFileSync("wallet.db", Buffer.from(data));
    process.exit(0);
  });

  return dbInstance;
}

export const db = await getDb();
