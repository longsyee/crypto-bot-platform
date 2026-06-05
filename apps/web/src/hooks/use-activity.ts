import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./use-auth";

export interface ActivityLog {
  id: string;
  botId?: string;
  botName?: string;
  botType?: string;
  level: "info" | "warn" | "error";
  category: "order" | "signal" | "state" | "system" | "trade" | "fee" | "alert";
  source: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export function useActivityStream(botId?: string, category?: string) {
  const token = useAuth((s) => s.token);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [connected, setConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => setLogs([]), []);

  useEffect(() => {
    if (!token) return;
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3010";
    const url = new URL(`${API_BASE}/logs/stream`);
    if (botId) url.searchParams.set("botId", botId);
    if (category) url.searchParams.set("category", category);

    let isClosed = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      if (isClosed) return;
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: abort.signal,
        });

        if (!res.ok || !res.body) {
          console.error("Activity stream failed:", res.status);
          setConnected(false);
          scheduleReconnect();
          return;
        }

        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!isClosed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          let currentData = "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              // Dispatch complete event
              if (currentEvent === "log" && currentData) {
                try {
                  const log = JSON.parse(currentData);
                  setLogs((prev) => {
                    if (prev.some((p) => p.id === log.id)) return prev;
                    return [...prev, log].slice(-500);
                  });
                } catch {
                  // ignore parse errors
                }
              }
              currentEvent = "";
              currentData = "";
              continue;
            }
            if (trimmed.startsWith("event:")) {
              currentEvent = trimmed.slice(6).trim();
            } else if (trimmed.startsWith("data:")) {
              currentData = trimmed.slice(5).trim();
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Activity stream error:", err);
        setConnected(false);
      }

      if (!isClosed) {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(() => {
        if (!isClosed) connect();
      }, 5000);
    }

    connect();

    return () => {
      isClosed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      abortRef.current?.abort();
    };
  }, [token, botId, category]);

  return { logs, connected, clear };
}
