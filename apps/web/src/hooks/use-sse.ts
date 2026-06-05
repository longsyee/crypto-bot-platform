import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export function useSSE() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;

    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3010";
    let abortController = new AbortController();
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let isClosed = false;

    async function connect() {
      try {
        const res = await fetch(`${API_BASE}/events`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          console.error("SSE connection failed:", res.status);
          scheduleReconnect();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!isClosed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed.startsWith("data:")) {
              const data = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.event === "trade-filled" ||
                  parsed.event === "balance-updated"
                ) {
                  qc.invalidateQueries({ queryKey: ["wallet"] });
                  qc.invalidateQueries({ queryKey: ["transactions"] });
                  qc.invalidateQueries({ queryKey: ["bots"] });
                }
              } catch {
                // ignore non-JSON data
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("SSE error:", err);
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
      abortController.abort();
    };
  }, [token, qc]);
}
