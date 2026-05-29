import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import walletRoutes from "./routes/wallets";
import connectionRoutes from "./routes/exchange-connections";
import botRoutes from "./routes/bots";
import referralRoutes from "./routes/referrals";
import adminRoutes from "./routes/admin";
import webhookRoutes from "./routes/webhooks";
import { setupSSE } from "./services/sse";

export const app = new Hono();

app.use(logger());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/wallets", walletRoutes);
app.route("/exchange-connections", connectionRoutes);
app.route("/bots", botRoutes);
app.route("/referrals", referralRoutes);
app.route("/admin", adminRoutes);
app.route("/webhooks", webhookRoutes);

setupSSE(app);

app.get("/health", (c) => c.json({ success: true, data: "ok" }));

// Start server if this file is the entrypoint
if (import.meta.main) {
  const port = parseInt(process.env.API_PORT || "3000");
  console.log(`API Server running on port ${port}`);
  Bun.serve({ fetch: app.fetch, port });
}
