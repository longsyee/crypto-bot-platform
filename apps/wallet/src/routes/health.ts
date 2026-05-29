import { Hono } from "hono";

const health = new Hono();

health.get("/health", (c) => c.json({ success: true, data: "wallet-ok" }));

export default health;
