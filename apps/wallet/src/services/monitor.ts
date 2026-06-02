import { ethers } from "ethers";
import { db } from "../db/client";
import { blockchainEvents, depositAddresses } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { walletConfig } from "../config";
import { sendDepositCallback } from "./callback";

const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const REQUIRED_CONFIRMATIONS = 12;

const erc20Abi = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export async function startMonitor(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(walletConfig.BSC_RPC_URL);
  const contract = new ethers.Contract(USDT_CONTRACT, erc20Abi, provider);

  contract.on(
    "Transfer",
    async (from: string, to: string, value: bigint, event: any) => {
      const amount = parseFloat(ethers.formatUnits(value, 18));
      const txHash = event.log.transactionHash;
      const blockNumber = Number(event.log.blockNumber);

      const addrRows = await db.select().from(depositAddresses).where(eq(depositAddresses.bscAddress, to)).limit(1);
      const addr = addrRows[0];
      if (!addr) return;

      const existingRows = await db.select().from(blockchainEvents).where(eq(blockchainEvents.txHash, txHash)).limit(1);
      if (existingRows[0]) return;

      await db.insert(blockchainEvents).values({
        id: crypto.randomUUID(),
        txHash,
        fromAddress: from,
        toAddress: to,
        amount,
        tokenContract: USDT_CONTRACT,
        blockNumber,
        matchedUserId: addr.userId,
      });
    }
  );

  setInterval(async () => {
    const pending = await db.select().from(blockchainEvents).where(
      and(
        eq(blockchainEvents.status, "pending"),
        eq(blockchainEvents.tokenContract, USDT_CONTRACT)
      )
    );
    const currentBlock = await provider.getBlockNumber();
    for (const event of pending) {
      const confs = currentBlock - event.blockNumber;
      if (confs >= REQUIRED_CONFIRMATIONS) {
        await db
          .update(blockchainEvents)
          .set({ status: "confirmed", confirmations: confs })
          .where(eq(blockchainEvents.id, event.id));
        await sendDepositCallback({
          userId: event.matchedUserId!,
          amount: event.amount,
          txHash: event.txHash,
          confirmations: confs,
        });
      } else {
        await db
          .update(blockchainEvents)
          .set({ confirmations: confs })
          .where(eq(blockchainEvents.id, event.id));
      }
    }
  }, 30000);
}
