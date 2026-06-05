import { ethers } from "ethers";
import { db } from "../db/client";
import { blockchainEvents, depositAddresses } from "../db/schema";
import { eq, and, count } from "drizzle-orm";
import { walletConfig } from "../config";
import { sendDepositCallback } from "./callback";

const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const REQUIRED_CONFIRMATIONS = 12;

// --- Infura survival tuning ---
const SCAN_INTERVAL_MS = 20_000;      // 20s base
const CONFIRMATION_INTERVAL_MS = 60_000;
const MAX_LOGS_RANGE = 50;            // tiny chunks
const RETRY_BASE_MS = 5_000;          // 5s base backoff
const RETRY_MAX = 5;
const CIRCUIT_BREAKER_LIMIT = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 120_000;
const MAX_TOPIC_ADDRESSES = 50;       // cap per-address log filtering

const erc20Abi = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const iface = new ethers.Interface(erc20Abi);
const TRANSFER_EVENT_HASH = ethers.id("Transfer(address,address,uint256)");

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const e = err as Record<string, unknown>;
  if (e.code === "BAD_DATA" && Array.isArray(e.value)) {
    return e.value.some(
      (v: any) =>
        v?.error?.code === -32005 ||
        /rate limit|too many requests/i.test(String(v?.error?.message ?? ""))
    );
  }
  const msg = String(
    e.message ?? e.shortMessage ?? e.reason ?? err
  ).toLowerCase();
  return /rate limit|too many requests|-32005|exceeded/i.test(msg);
}

export async function startMonitor(): Promise<void> {
  let provider = new ethers.JsonRpcProvider(walletConfig.BSC_RPC_URL);

  let lastCheckedBlock = await provider.getBlockNumber();
  let consecutiveRateLimits = 0;
  let circuitBreakerUntil = 0;
  let scanning = false;

  // --- Smart deposit detection loop ---
  setInterval(async () => {
    if (scanning) return;
    if (Date.now() < circuitBreakerUntil) {
      console.warn(
        `Monitor in cooldown. Resuming in ${Math.round(
          (circuitBreakerUntil - Date.now()) / 1000
        )}s.`
      );
      return;
    }

    scanning = true;
    try {
      // 1. Decide if we even need to touch the RPC
      const [pendingCount, activeAddrRows] = await Promise.all([
        db
          .select({ count: count() })
          .from(blockchainEvents)
          .where(
            and(
              eq(blockchainEvents.status, "pending"),
              eq(blockchainEvents.tokenContract, USDT_CONTRACT)
            )
          ),
        db
          .select()
          .from(depositAddresses)
          .where(eq(depositAddresses.status, "active")),
      ]);

      const hasPending = pendingCount[0].count > 0;
      const hasActiveAddresses = activeAddrRows.length > 0;

      if (!hasPending && !hasActiveAddresses) {
        console.log(
          "Smart poll: no active addresses or pending deposits. Skipping scan."
        );
        return;
      }

      // 2. Fast lookups for address validation
      const ourAddresses = new Set(
        activeAddrRows.map((a) => a.bscAddress.toLowerCase())
      );
      const addrMap = new Map(
        activeAddrRows.map((a) => [a.bscAddress.toLowerCase(), a])
      );

      const head = await provider.getBlockNumber();
      if (head <= lastCheckedBlock) return;

      let from = lastCheckedBlock + 1;
      const to = head;

      // 3. Build an optimized topic filter when address count is small
      const toTopics: string[] | null =
        activeAddrRows.length <= MAX_TOPIC_ADDRESSES
          ? activeAddrRows.map((a) =>
              ethers.zeroPadValue(a.bscAddress, 32)
            )
          : null;

      // 4. Scan in tiny chunks
      while (from <= to) {
        const chunkTo = Math.min(from + MAX_LOGS_RANGE - 1, to);

        const filter: ethers.Filter = {
          address: USDT_CONTRACT,
          topics: [TRANSFER_EVENT_HASH, null, toTopics],
          fromBlock: from,
          toBlock: chunkTo,
        };

        let logs: ethers.Log[] = [];
        let chunkOk = false;

        for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
          try {
            logs = await provider.getLogs(filter);
            chunkOk = true;
            break;
          } catch (err) {
            if (!isRateLimitError(err)) throw err;
            const delay =
              RETRY_BASE_MS * 2 ** attempt + Math.random() * 2_000;
            console.warn(
              `Rate limited on eth_getLogs (chunk ${from}..${chunkTo}), ` +
                `backing off ${Math.round(delay)}ms ` +
                `(attempt ${attempt + 1}/${RETRY_MAX})...`
            );
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        if (!chunkOk) {
          consecutiveRateLimits++;
          if (consecutiveRateLimits >= CIRCUIT_BREAKER_LIMIT) {
            circuitBreakerUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
            console.warn(
              `Circuit breaker tripped. Pausing scans for ${
                CIRCUIT_BREAKER_COOLDOWN_MS / 1000
              }s.`
            );
          } else {
            console.error(
              `Failed to fetch logs for ${from}..${chunkTo} after ${RETRY_MAX} attempts.`
            );
          }
          return; // abort this scan run
        }

        consecutiveRateLimits = 0;

        for (const log of logs) {
          const parsed = iface.parseLog(log);
          if (!parsed) continue;

          const fromAddr = String(parsed.args[0]);
          const toAddr = String(parsed.args[1]);
          const value = parsed.args[2] as bigint;

          // Defensive check (the topic filter should already handle this)
          if (!ourAddresses.has(toAddr.toLowerCase())) continue;

          const amount = parseFloat(ethers.formatUnits(value, 18));
          const txHash = log.transactionHash;
          const eventBlockNumber = Number(log.blockNumber);

          const existingRows = await db
            .select()
            .from(blockchainEvents)
            .where(eq(blockchainEvents.txHash, txHash))
            .limit(1);
          if (existingRows[0]) continue;

          const addr = addrMap.get(toAddr.toLowerCase())!;

          await db.insert(blockchainEvents).values({
            id: crypto.randomUUID(),
            txHash,
            fromAddress: fromAddr,
            toAddress: toAddr,
            amount,
            tokenContract: USDT_CONTRACT,
            blockNumber: eventBlockNumber,
            matchedUserId: addr.userId,
          });
        }

        lastCheckedBlock = chunkTo;
        from = chunkTo + 1;
      }
    } catch (err) {
      console.error("Monitor scan loop error:", err);
    } finally {
      scanning = false;
    }
  }, SCAN_INTERVAL_MS);

  // --- Confirmation loop (only runs when there are pending events) ---
  setInterval(async () => {
    try {
      const pending = await db
        .select()
        .from(blockchainEvents)
        .where(
          and(
            eq(blockchainEvents.status, "pending"),
            eq(blockchainEvents.tokenContract, USDT_CONTRACT)
          )
        );

      if (!pending.length) return;

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
    } catch (err) {
      console.error("Monitor confirmation loop error:", err);
    }
  }, CONFIRMATION_INTERVAL_MS);
}
