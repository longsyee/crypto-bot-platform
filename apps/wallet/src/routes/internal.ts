import { Hono } from "hono";
import { generateBscAddress } from "../services/hd-wallet";
import { db } from "../db/client";
import { depositAddresses } from "../db/schema";
import { eq } from "drizzle-orm";

const internal = new Hono();

internal.post("/generate-address", async (c) => {
  const { userId } = await c.req.json();
  const existing = await db.query.depositAddresses.findFirst({
    where: eq(depositAddresses.userId, userId),
  });
  if (existing) return c.json({ success: true, data: { address: existing.bscAddress } });

  const countRes = await db.select({ count: depositAddresses.id }).from(depositAddresses);
  const count = countRes.length;
  const { address } = generateBscAddress(count);
  await db.insert(depositAddresses).values({
    id: crypto.randomUUID(),
    userId,
    addressIndex: count,
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
