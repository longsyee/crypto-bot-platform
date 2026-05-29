import { Hono } from "hono";
import { logger } from "hono/logger";
import internalRoutes from "./routes/internal";
import healthRoutes from "./routes/health";
import { startMonitor } from "./services/monitor";
import { startSweeper } from "./services/sweeper";

const app = new Hono();
app.use(logger());

app.route("/internal", internalRoutes);
app.route("/", healthRoutes);

const port = parseInt(process.env.WALLET_PORT || "3001");
console.log(`Wallet Service running on port ${port}`);

// Bun.serve is optional; fallback to Node if not available
if (typeof Bun !== "undefined" && import.meta.main) {
  Bun.serve({ fetch: app.fetch, port });
} else if (import.meta.main) {
  // Node fallback would require @hono/node-server; kept minimal
  console.log("Start with Bun or integrate @hono/node-server for Node runtime.");
}

startMonitor().catch(console.error);
startSweeper();

export { app };
