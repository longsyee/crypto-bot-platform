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

export function usePauseBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<any>(`/bots/${id}/pause`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bots"] }),
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
