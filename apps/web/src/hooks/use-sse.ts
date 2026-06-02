import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export function useSSE() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3010";
    const es = new EventSource(`${API_BASE}/events`, {
      withCredentials: true,
    });

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === "trade-filled" || parsed.event === "balance-updated") {
          qc.invalidateQueries({ queryKey: ["wallet"] });
          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["bots"] });
        }
      } catch {
        // ignore non-JSON pings
      }
    };

    es.onerror = (err) => {
      console.error("SSE error", err);
    };

    return () => {
      es.close();
    };
  }, [token, qc]);
}
