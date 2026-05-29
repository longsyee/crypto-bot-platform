import { ethers } from "ethers";
import { db } from "../db/client";
import { depositAddresses, withdrawalRequests } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { walletConfig } from "../config";

const provider = new ethers.JsonRpcProvider(walletConfig.BSC_RPC_URL);
const hotWallet = new ethers.Wallet(walletConfig.HOT_WALLET_PRIVATE_KEY, provider);

const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const erc20Abi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
];

const usdt = new ethers.Contract(USDT_CONTRACT, erc20Abi, hotWallet);

export async function runSweep(): Promise<void> {
  const addresses = await db.query.depositAddresses.findMany({
    where: and(eq(depositAddresses.status, "active")),
  });

  for (const addr of addresses) {
    try {
      const rawBalance: bigint = await usdt.balanceOf(addr.bscAddress);
      const balance = parseFloat(ethers.formatUnits(rawBalance, 18));
      if (balance > walletConfig.SWEEP_MIN_THRESHOLD) {
        console.log(`Sweeping ${balance} USDT from ${addr.bscAddress}`);
        // In production, transfer USDT from deposit address to hot wallet
        // Requires deposit address private key; placeholder below
      }
    } catch (err) {
      console.error(`Sweep error for ${addr.bscAddress}:`, err);
    }
  }
}

export function startSweeper(): void {
  setInterval(() => {
    runSweep().catch(console.error);
  }, 60000);
}
