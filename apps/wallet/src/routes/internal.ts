import { Hono } from "hono";
import { generateBscAddress } from "../services/hd-wallet";
import { db } from "../db/client";
import { depositAddresses } from "../db/schema";
import { eq, max } from "drizzle-orm";
import crypto from "crypto";

const internal = new Hono();

internal.post("/generate-address", async (c) => {
  const { userId } = await c.req.json();
  const existingRows = await db.select().from(depositAddresses).where(eq(depositAddresses.userId, userId)).limit(1);
  const existing = existingRows[0];
  if (existing) return c.json({ success: true, data: { address: existing.bscAddress } });

  const maxRes = await db.select({ maxIdx: max(depositAddresses.addressIndex) }).from(depositAddresses);
  const nextIndex = (maxRes[0]?.maxIdx ?? -1) + 1;
  const { address } = generateBscAddress(nextIndex);
  await db.insert(depositAddresses).values({
    id: crypto.randomUUID(),
    userId,
    addressIndex: nextIndex,
    bscAddress: address,
  });
  return c.json({ success: true, data: { address } });
});

internal.post("/withdraw", async (c) => {
  const { userId, amount, toAddress } = await c.req.json();
  // Placeholder: validate, sign tx, broadcast, store in withdrawal_requests
  return c.json({ success: true, data: { status: "pending" } });
});

export default internal;
