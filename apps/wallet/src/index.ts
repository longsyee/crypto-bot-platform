import { Hono } from "hono";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import internalRoutes from "./routes/internal";
import healthRoutes from "./routes/health";
import { startMonitor } from "./services/monitor";
import { startSweeper } from "./services/sweeper";

const app = new Hono();
app.use(logger());

app.route("/internal", internalRoutes);
app.route("/", healthRoutes);

const port = parseInt(process.env.WALLET_PORT || "3011");
serve({ fetch: app.fetch, port });
console.log(`Wallet Service running on port ${port}`);

startMonitor().catch(console.error);
startSweeper();

export { app };
