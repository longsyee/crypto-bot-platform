import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<any>("/users/me"),
    retry: false,
  });
}

export function useBots() {
  return useQuery({
    queryKey: ["bots"],
    queryFn: () => api<any[]>("/bots"),
  });
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => api<any>("/wallets/me"),
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: () => api<{ data: any[]; meta: any }>("/wallets/transactions"),
  });
}

export function useStartBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/bots/${id}/start`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
  });
}

export function useStopBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/bots/${id}/stop`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
  });
}

export function useBot(id: string) {
  return useQuery({
    queryKey: ["bots", id],
    queryFn: () => api<any>(`/bots/${id}`),
  });
}

export function useBotOrders(id: string) {
  return useQuery({
    queryKey: ["bots", id, "orders"],
    queryFn: () => api<any[]>(`/bots/${id}/orders`),
  });
}

export function useBotLogs(id: string) {
  return useQuery({
    queryKey: ["bots", id, "logs"],
    queryFn: () => api<any[]>(`/bots/${id}/logs`),
    refetchInterval: 5000,
  });
}

export function useBotPaperTrades(id: string) {
  return useQuery({
    queryKey: ["bots", id, "paper-trades"],
    queryFn: () => api<any[]>(`/bots/${id}/paper-trades`),
  });
}

export function useBotLivePrice(id: string) {
  return useQuery({
    queryKey: ["bots", id, "price"],
    queryFn: () => api<{ lastPrice: number; bid: number; ask: number; change24hPct: number }>(`/bots/${id}/price`),
    refetchInterval: 5000,
    enabled: !!id,
  });
}

export function useUpdateBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; configJson?: any } }) =>
      api<any>(`/bots/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      qc.invalidateQueries({ queryKey: ["bots", id] });
    },
  });
}

export function useExitBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<any>(`/bots/${id}/exit`, { method: "POST" }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      qc.invalidateQueries({ queryKey: ["bots", id] });
    },
  });
}

export function useConvert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { amount: number; direction: string }) =>
      api<any>("/wallets/convert", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useReferrals() {
  return useQuery({
    queryKey: ["referrals"],
    queryFn: () => api<any>("/referrals/me"),
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api<any>("/admin/dashboard"),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<{ data: any[]; meta: any }>("/users"),
  });
}

export function useAdminBots() {
  return useQuery({
    queryKey: ["admin-bots"],
    queryFn: () => api<any[]>("/bots/admin/all"),
  });
}

export function useAdminAuditLog(page = 1, limit = 20, action?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (action) params.append("action", action);
  return useQuery({
    queryKey: ["admin-audit-log", page, limit, action],
    queryFn: () => api<{ data: any[]; meta: any }>(`/admin/audit-log?${params.toString()}`),
  });
}

export function useAdminSecurityEvents(page = 1, limit = 20, eventType?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (eventType) params.append("eventType", eventType);
  return useQuery({
    queryKey: ["admin-security-events", page, limit, eventType],
    queryFn: () => api<{ data: any[]; meta: any }>(`/admin/security-events?${params.toString()}`),
  });
}

export function useAdminReferrals() {
  return useQuery({
    queryKey: ["admin-referrals"],
    queryFn: () => api<any[]>("/admin/referrals"),
  });
}

export function useKillBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/admin/bots/${id}/kill`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-bots"] }),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api<any>(`/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      api<any>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ suspended }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useApproveKol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/admin/referrals/${id}/approve-kol`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-referrals"] }),
  });
}

export function useExchangeConnections() {
  return useQuery({
    queryKey: ["exchange-connections"],
    queryFn: () => api<any[]>("/exchange-connections"),
  });
}

export function useExchangeMarkets(connectionId: string) {
  return useQuery({
    queryKey: ["exchange-markets", connectionId],
    queryFn: () => api<any[]>(`/exchange-connections/${connectionId}/markets`),
    enabled: !!connectionId,
  });
}

export function useExchangeBalance(id: string) {
  return useQuery({
    queryKey: ["exchange-connections", id, "balance"],
    queryFn: () => api<any>(`/exchange-connections/${id}/balance`),
    enabled: !!id,
  });
}

export function useCreateExchangeConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      exchangeId: string;
      name: string;
      apiKey: string;
      apiSecret: string;
      passphrase?: string;
    }) =>
      api<any>("/exchange-connections", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exchange-connections"] }),
  });
}

export function useDeleteExchangeConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/exchange-connections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exchange-connections"] }),
  });
}

export function useCreateBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      connectionId: string;
      mode: string;
      tradingPair: string;
      paperInitialBalance?: Record<string, number>;
      config: any;
    }) =>
      api<any>("/bots", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
  });
}

export function useDeleteBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/bots/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
  });
}

export function useToggleBotMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: string }) =>
      api<any>(`/bots/${id}/mode`, {
        method: "PATCH",
        body: JSON.stringify({ mode }),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["bots"] });
      qc.invalidateQueries({ queryKey: ["bots", id] });
    },
  });
}

export function useGenerateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<any>("/wallets/generate-address", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
