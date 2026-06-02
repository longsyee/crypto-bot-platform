import { Redis } from "ioredis";
import { config } from "./config";
import { writeHeartbeat } from "./services/heartbeat";

// Global error handling — prevent one bug from killing the entire worker
process.on("uncaughtException", (err) => {
  console.error("[WORKER] Uncaught exception:", err);
  // Keep running; individual bot loops have their own error handling
});

process.on("unhandledRejection", (reason) => {
  console.error("[WORKER] Unhandled rejection:", reason);
});

// Redis connection with auto-reconnect
export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    console.log(`[WORKER] Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ["READONLY", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redisConnection.on("connect", () => console.log("[WORKER] Redis connected"));
redisConnection.on("error", (err) => console.error("[WORKER] Redis error:", err.message));
redisConnection.on("reconnecting", () => console.log("[WORKER] Redis reconnecting..."));

// Import consumer after Redis is ready so it uses the same connection
import("./queues/consumer").catch((err) => {
  console.error("[WORKER] Failed to start queue consumer:", err);
  process.exit(1);
});

console.log("[WORKER] Bot Worker started — PID", process.pid);

// Heartbeat every 30s
setInterval(writeHeartbeat, 30000);
