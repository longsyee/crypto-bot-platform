import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { logRoutes } from "./routes/logs.js";

const app = new Hono();

app.use(cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true, service: "log-server" }));

app.route("/", logRoutes);

serve({ fetch: app.fetch, port: config.LOG_SERVER_PORT });
console.log(`Log Server running on port ${config.LOG_SERVER_PORT}`);
