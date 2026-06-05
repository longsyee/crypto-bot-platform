import { walletConfig } from "../config";

interface DepositCallback {
  userId: string;
  amount: number;
  txHash: string;
  confirmations: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function sendDepositCallback(payload: DepositCallback): Promise<void> {
  const maxRetries = 5;
  const baseDelayMs = 2000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(walletConfig.API_CALLBACK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(walletConfig.INTERNAL_API_SECRET ? { "X-Internal-Secret": walletConfig.INTERNAL_API_SECRET } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
      console.error(`Deposit callback failed (attempt ${attempt + 1}/${maxRetries + 1}):`, await res.text());
    } catch (err: any) {
      console.error(`Deposit callback error (attempt ${attempt + 1}/${maxRetries + 1}):`, err.message);
    }
    if (attempt < maxRetries) {
      await sleep(baseDelayMs * Math.pow(2, attempt));
    }
  }

  console.error(`Deposit callback permanently failed for tx ${payload.txHash}`);
}
