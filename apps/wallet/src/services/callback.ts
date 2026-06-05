import { walletConfig } from "../config";

interface DepositCallback {
  userId: string;
  amount: number;
  txHash: string;
  confirmations: number;
}

export async function sendDepositCallback(payload: DepositCallback): Promise<void> {
  const res = await fetch(walletConfig.API_CALLBACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(walletConfig.INTERNAL_API_SECRET ? { "X-Internal-Secret": walletConfig.INTERNAL_API_SECRET } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error("Deposit callback failed", await res.text());
  }
}
