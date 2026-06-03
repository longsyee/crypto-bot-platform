import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { pathToFileURL } from "node:url";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import walletRoutes from "./routes/wallets";
import connectionRoutes from "./routes/exchange-connections";
import botRoutes from "./routes/bots";
import referralRoutes from "./routes/referrals";
import adminRoutes from "./routes/admin";
import webhookRoutes from "./routes/webhooks";
import logRoutes from "./routes/logs";
import internalRoutes from "./routes/internal";
import rankingsRoutes from "./routes/rankings";
import { setupSSE } from "./services/sse";
import { config } from "./config";

export const app = new Hono();

const allowedOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);

app.use(logger());
app.use(cors({
  origin: (origin) => {
    if (!origin) return allowedOrigins[0];
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  credentials: true,
}));

app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/wallets", walletRoutes);
app.route("/exchange-connections", connectionRoutes);
app.route("/bots", botRoutes);
app.route("/referrals", referralRoutes);
app.route("/admin", adminRoutes);
app.route("/webhooks", webhookRoutes);
app.route("/logs", logRoutes);
app.route("/internal", internalRoutes);
app.route("/rankings", rankingsRoutes);

setupSSE(app);

app.get("/health", (c) => c.json({ success: true, data: "ok" }));

// Start server if this file is the entrypoint
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = parseInt(process.env.API_PORT || "3010");
  serve({ fetch: app.fetch, port });
  console.log(`API Server running on port ${port}`);
}
