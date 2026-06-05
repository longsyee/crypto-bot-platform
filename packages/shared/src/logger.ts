/**
 * Shared log client for posting structured logs to the Log Server.
 * Falls back to console if LOG_SERVER_URL is not set.
 */

export type LogLevel = "info" | "warn" | "error";
export type LogCategory = "order" | "signal" | "state" | "system" | "trade" | "fee" | "alert";
export type LogSource = "worker" | "api" | "webhook" | "user" | "system";

export interface LogPayload {
  botId: string;
  userId?: string;
  level?: LogLevel;
  category?: LogCategory;
  source?: LogSource;
  message: string;
  metadata?: Record<string, any>;
}

const LOG_SERVER_URL =
  typeof process !== "undefined"
    ? (process.env.LOG_SERVER_URL ?? "http://localhost:3012")
    : "/api/logs-proxy"; // browser fallback

const LOG_API_KEY =
  typeof process !== "undefined"
    ? (process.env.LOG_SERVER_API_KEY ?? "dev-log-key-change-me")
    : "";

function isNode() {
  return typeof process !== "undefined" && process.versions?.node != null;
}

/**
 * Send a single structured log to the log server.
 * Returns true if accepted, false if skipped/failed.
 */
export async function sendLog(payload: LogPayload): Promise<boolean> {
  if (!isNode()) {
    // Browser: post to API proxy endpoint (we'll add this in API)
    try {
      await fetch(`${LOG_SERVER_URL}/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(LOG_API_KEY ? { "x-log-api-key": LOG_API_KEY } : {}),
        },
        body: JSON.stringify(payload),
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const res = await fetch(`${LOG_SERVER_URL}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-log-api-key": LOG_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    // Fallback to console so we never lose logs
    console.error("[LogServer] Failed to send log:", err);
    console.log(`[${payload.level ?? "info"}][${payload.category ?? "system"}] ${payload.message}`);
    return false;
  }
}

/**
 * Send a batch of logs in one request.
 */
export async function sendLogsBatch(batch: LogPayload[]): Promise<boolean> {
  if (batch.length === 0) return true;
  if (!isNode()) {
    try {
      const res = await fetch(`${LOG_SERVER_URL}/logs/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(LOG_API_KEY ? { "x-log-api-key": LOG_API_KEY } : {}),
        },
        body: JSON.stringify(batch),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  try {
    const res = await fetch(`${LOG_SERVER_URL}/logs/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-log-api-key": LOG_API_KEY,
      },
      body: JSON.stringify(batch),
    });
    return res.ok;
  } catch (err) {
    console.error("[LogServer] Batch failed:", err);
    batch.forEach((p) =>
      console.log(`[${p.level ?? "info"}][${p.category ?? "system"}] ${p.message}`)
    );
    return false;
  }
}

/**
 * Convenience builders for common log types.
 */
export const logOrder = (p: { botId: string; userId?: string; message: string; metadata?: Record<string, any> }) =>
  sendLog({ ...p, category: "order", source: "api", level: "info" });

export const logSignal = (p: { botId: string; userId?: string; message: string; metadata?: Record<string, any> }) =>
  sendLog({ ...p, category: "signal", source: "webhook", level: "info" });

export const logState = (p: { botId: string; userId?: string; message: string; level?: LogLevel; metadata?: Record<string, any> }) =>
  sendLog({ ...p, category: "state", source: "worker", level: p.level ?? "info" });

export const logTrade = (p: { botId: string; userId?: string; message: string; metadata?: Record<string, any> }) =>
  sendLog({ ...p, category: "trade", source: "worker", level: "info" });

export const logFee = (p: { botId: string; userId?: string; message: string; metadata?: Record<string, any> }) =>
  sendLog({ ...p, category: "fee", source: "worker", level: "info" });

export const logAlert = (p: { botId: string; userId?: string; message: string; metadata?: Record<string, any> }) =>
  sendLog({ ...p, category: "alert", source: "system", level: "warn" });
