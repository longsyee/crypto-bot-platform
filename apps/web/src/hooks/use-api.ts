import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useToast } from "./use-toast";

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
    queryFn: () => api<any[]>("/wallets/transactions"),
  });
}

export function useStartBot() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/bots/${id}/start`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
    onError: (err: any) => {
      toast.error(err?.message || "Failed to start bot");
    },
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

export function useCancelOrder(botId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<any>(`/bots/${botId}/orders/${orderId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bots", botId, "orders"] });
    },
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
    mutationFn: (payload: { amount: number }) =>
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

export function useWithdrawReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { amount: number }) =>
      api<any>("/referrals/withdraw", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["referrals"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useReferralWithdrawals() {
  return useQuery({
    queryKey: ["referral-withdrawals"],
    queryFn: () => api<any[]>("/referrals/withdrawals"),
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
    queryFn: () => api<any[]>("/users"),
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
    queryFn: () => api<any[]>(`/admin/audit-log?${params.toString()}`),
  });
}

export function useAdminSecurityEvents(page = 1, limit = 20, eventType?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (eventType) params.append("eventType", eventType);
  return useQuery({
    queryKey: ["admin-security-events", page, limit, eventType],
    queryFn: () => api<any[]>(`/admin/security-events?${params.toString()}`),
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

export function useCompanyStats() {
  return useQuery({
    queryKey: ["company-stats"],
    queryFn: () => api<any>("/admin/company-stats"),
  });
}

export function useAdminReferralWithdrawals(status = "pending", page = 1, limit = 20) {
  const params = new URLSearchParams({ status, page: String(page), limit: String(limit) });
  return useQuery({
    queryKey: ["admin-referral-withdrawals", status, page, limit],
    queryFn: () => api<any[]>(`/admin/referral-withdrawals?${params.toString()}`),
  });
}

export function useApproveReferralWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/admin/referral-withdrawals/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-referral-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["company-stats"] });
    },
  });
}

export function useRejectReferralWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api<any>(`/admin/referral-withdrawals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-referral-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["company-stats"] });
    },
  });
}

export function useRankings(period = "overall") {
  return useQuery({
    queryKey: ["rankings", period],
    queryFn: () => api<{ data: any[]; meta: any }>(`/rankings?period=${period}`),
  });
}

export function useToggleShowcasePaperTrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, showcasePaperTrades }: { id: string; showcasePaperTrades: boolean }) =>
      api<any>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ showcasePaperTrades }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["rankings"] });
    },
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

// ------------------------------------------------------------------
// Avatar
// ------------------------------------------------------------------

export function useAvatar() {
  return useQuery({
    queryKey: ["avatar"],
    queryFn: () => api<string>("/users/me/avatar"),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      return api<any>("/users/me/avatar", {
        method: "POST",
        body: fd,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avatar"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<any>("/users/me/avatar", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["avatar"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// ------------------------------------------------------------------
// API Keys
// ------------------------------------------------------------------

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api<any[]>("/api-keys"),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; permissions?: string[]; expiresInDays?: number | null; totpCode?: string }) =>
      api<any>("/api-keys", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useUpdateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; permissions?: string[]; expiresAt?: string | null } }) =>
      api<any>(`/api-keys/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

// ------------------------------------------------------------------
// Community / Copy Trading
// ------------------------------------------------------------------

export function useSharedBots(mode?: "paper" | "live") {
  const params = mode ? `?mode=${mode}` : "";
  return useQuery({
    queryKey: ["shared-bots", mode],
    queryFn: () => api<any[]>(`/bots/community/shared${params}`),
  });
}

export function useCopyBot() {
  return useMutation({
    mutationFn: ({ botId, connectionId, mode }: { botId: string; connectionId: string; mode: "paper" | "live" }) =>
      api<any>(`/bots/${botId}/copy`, {
        method: "POST",
        body: JSON.stringify({ connectionId, mode }),
      }),
  });
}

export function useShareBot() {
  return useMutation({
    mutationFn: ({ botId, mode }: { botId: string; mode: "paper" | "live" }) =>
      api<any>(`/bots/${botId}/share`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      }),
  });
}

// ------------------------------------------------------------------
// 2FA
// ------------------------------------------------------------------

export function useSetup2FA() {
  return useMutation({
    mutationFn: () =>
      api<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup", {
        method: "POST",
      }),
  });
}

export function useVerify2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api<any>("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useDisable2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      api<any>("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useLogin2FA() {
  return useMutation({
    mutationFn: ({ tempToken, code }: { tempToken: string; code: string }) =>
      api<{
        accessToken: string;
        refreshToken: string;
        user: any;
      }>("/auth/2fa/login-verify", {
        method: "POST",
        body: JSON.stringify({ tempToken, code }),
      }),
  });
}

// ------------------------------------------------------------------
// SimFunds (Paper Trading)
// ------------------------------------------------------------------

export function useTopUpPaper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { usdtAmount: number }) =>
      api<any>("/wallets/topup-paper", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useSimFundsConfig() {
  return useQuery({
    queryKey: ["sim-funds-config"],
    queryFn: () => api<Record<string, string>>("/wallets/config"),
  });
}

export function useGrantSimFunds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { identifier: string; amount: number; reason?: string }) =>
      api<any>("/admin/sim-funds/grant", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
