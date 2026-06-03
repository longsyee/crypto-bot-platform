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
  const esRef = useRef<EventSource | null>(null);

  const clear = useCallback(() => setLogs([]), []);

  useEffect(() => {
    if (!token) return;
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3010";
    const url = new URL(`${API_BASE}/logs/stream`);
    if (botId) url.searchParams.set("botId", botId);
    if (category) url.searchParams.set("category", category);
    url.searchParams.set("token", token);

    const es = new EventSource(url.toString());
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener("log", (event) => {
      try {
        const log = JSON.parse(event.data);
        setLogs((prev) => {
          // Avoid duplicates
          if (prev.some((p) => p.id === log.id)) return prev;
          return [...prev, log].slice(-500); // keep last 500
        });
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [token, botId, category]);

  return { logs, connected, clear };
}
