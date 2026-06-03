/**
 * HTTP client for the crypto-bot-platform API.
 * Reads config from env vars or ~/.nexusbot/mcp-config.json
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface ApiConfig {
  apiBaseUrl: string;
  apiKey: string;
}

function loadConfig(): ApiConfig {
  const envUrl = process.env.NEXUSBOT_API_URL;
  const envKey = process.env.NEXUSBOT_API_KEY;

  if (envUrl && envKey) {
    return { apiBaseUrl: envUrl.replace(/\/$/, ""), apiKey: envKey };
  }

  const configPath = join(homedir(), ".nexusbot", "mcp-config.json");
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      apiBaseUrl: (parsed.apiBaseUrl || "http://localhost:3010").replace(/\/$/, ""),
      apiKey: parsed.apiKey,
    };
  }

  throw new Error(
    "Missing NexusBot API config. Set NEXUSBOT_API_URL and NEXUSBOT_API_KEY env vars, or create ~/.nexusbot/mcp-config.json"
  );
}

const config = loadConfig();

export async function apiGet<T>(path: string): Promise<{ success: boolean; data?: T; error?: string; code?: string }> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: {
      "X-API-Key": config.apiKey,
      "Content-Type": "application/json",
    },
  });
  return res.json() as any;
}

export async function apiPost<T>(path: string, body: unknown): Promise<{ success: boolean; data?: T; error?: string; code?: string }> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "X-API-Key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as any;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<{ success: boolean; data?: T; error?: string; code?: string }> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "X-API-Key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as any;
}

export async function apiDelete<T>(path: string): Promise<{ success: boolean; data?: T; error?: string; code?: string }> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: {
      "X-API-Key": config.apiKey,
      "Content-Type": "application/json",
    },
  });
  return res.json() as any;
}

export function formatError(result: { error?: string; code?: string }): string {
  return result.error || result.code || "Unknown API error";
}
