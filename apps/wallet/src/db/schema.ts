import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const depositAddresses = sqliteTable("deposit_addresses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  addressIndex: integer("address_index").notNull(),
  bscAddress: text("bsc_address").notNull().unique(),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const blockchainEvents = sqliteTable("blockchain_events", {
  id: text("id").primaryKey(),
  txHash: text("tx_hash").notNull().unique(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amount: real("amount").notNull(),
  tokenContract: text("token_contract").notNull(),
  blockNumber: integer("block_number").notNull(),
  confirmations: integer("confirmations").notNull().default(0),
  status: text("status", { enum: ["pending", "confirmed", "invalid"] }).notNull().default("pending"),
  matchedUserId: text("matched_user_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const withdrawalRequests = sqliteTable("withdrawal_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: real("amount").notNull(),
  toAddress: text("to_address").notNull(),
  txHash: text("tx_hash"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  feeEstimate: real("fee_estimate"),
  processedAt: integer("processed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
