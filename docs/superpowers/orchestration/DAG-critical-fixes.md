# CTO Orchestrate: Fix 5 Critical QA Issues

## Objective
Fix all 5 CRITICAL security and correctness bugs identified in the QA audit.

## Issues

### 1. Admin Refund Negative Amounts (CRITICAL — Fund Theft)
- **File:** `apps/api/src/routes/admin.ts` around line 82
- **Bug:** `/refund` reads `amount` from raw JSON with no validation. Negative amount decrements victim's wallet.
- **Fix:** Add Zod validation: `amount > 0` and `amount <= tx.amount`

### 2. Hardcoded Wallet Mnemonic (CRITICAL — Key Compromise)
- **File:** `apps/wallet/src/services/hd-wallet.ts` around line 4
- **Bug:** Fallback mnemonic `abandon abandon...` used if `WALLET_MNEMONIC` env is missing.
- **Fix:** Remove fallback. Throw descriptive error if env var missing.

### 3. DCA Restart Duplicate Base Orders (CRITICAL — Position Corruption)
- **File:** `apps/worker/src/engine/dca-loop.ts` around line 53-92
- **Bug:** On worker restart, `startDcaLoop` places a new base order even if stateJson exists.
- **Fix:** The resume logic already checks `persisted.baseOrderFilled` — but the `paperCreateOrder` throws before state can be restored. Fix the balance check so resume works.

### 4. Fee Deduction Not Atomic (CRITICAL — Accounting Mismatch)
- **File:** `apps/worker/src/services/fee-applier.ts` around line 18-34
- **Bug:** `transaction.create` and `wallet.update` are separate calls.
- **Fix:** Wrap in `prisma.$transaction([...])`

### 5. x-forwarded-for Spoofing (CRITICAL — Security Bypass)
- **Files:** `apps/api/src/middleware/rate-limit.ts`, `apps/api/src/middleware/ip-allowlist.ts`
- **Bug:** Both use raw `x-forwarded-for` header. Clients can spoof any IP.
- **Fix:** Read from `x-real-ip` (set by trusted proxy) or `c.env?.remoteAddress`. Ignore `x-forwarded-for`.

## DAG

```
Phase 1: Parallel Fixes
├── Fix 1: Admin refund validation (Coder Alpha)
├── Fix 2: Wallet mnemonic (Coder Delta)
├── Fix 3: DCA restart (Coder Gamma)
├── Fix 4: Fee atomicity (Coder Gamma)
└── Fix 5: IP spoofing (Coder Alpha)

Phase 2: TypeScript Verification
└── Compile all changed packages

Phase 3: QA Verification
├── QA Alpha: Re-read fixed files, verify logic
└── QA Beta: Check for regressions

Phase 4: Merge Report
```
