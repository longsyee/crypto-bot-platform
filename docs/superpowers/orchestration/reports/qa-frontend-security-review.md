# QA Frontend + Security Review Report

**Date:** 2026-05-29
**Reviewer:** QA Agent Gamma
**Scope:** apps/web/src/lib/api-client.ts, apps/web/src/hooks/use-auth.ts, apps/api/src/middleware/role.ts, apps/api/src/middleware/ip-allowlist.ts, apps/api/src/routes/admin.ts, apps/api/src/services/encryption.ts, apps/web/src/components/referral/tier-card.tsx, apps/web/src/components/bots/bot-wizard.tsx

---

## Summary

| Metric | Value |
|--------|-------|
| status | completed |
| report_path | C:\Users\Renaenys\Desktop\BOT\docs\superpowers\orchestration\reports\qa-frontend-security-review.md |
| issues_found_count | 20 |
| security_flags_count | 9 |

---

## Detailed Findings

### api-client.ts

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| api-client.ts | JWT access token stored in localStorage (acceptable for MVP; migrate to httpOnly cookie or secure session in v2) | Info | noted |
| api-client.ts | `fetch()` has no request timeout; hung requests can block UI indefinitely | Low | open |
| api-client.ts | No CSRF protection on state-changing requests | Low | open |
| api-client.ts | `res.json()` assumes every response is JSON; non-JSON error bodies will throw unhandled SyntaxError | Low | open |

### use-auth.ts

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| use-auth.ts | JWT access token and user object stored in localStorage (acceptable for MVP; note for v2 hardening) | Info | noted |
| use-auth.ts | No automatic refresh token exchange; 15-minute access tokens will force frequent re-login | Medium | open |
| use-auth.ts | `JSON.parse(localStorage.getItem("user") \|\| "null")` will crash on malformed JSON, breaking the app on corruption | Low | open |

### role.ts

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| role.ts | No issues found; correctly checks user existence and role inclusion | — | pass |

### ip-allowlist.ts

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| ip-allowlist.ts | `x-forwarded-for` is used without verifying a trusted proxy is in front; trivial to spoof if API is exposed directly | High | open |
| ip-allowlist.ts | Exact-string IP matching only; no CIDR support (e.g., cannot allowlist `10.0.0.0/8`) | Low | open |
| ip-allowlist.ts | `c.env?.remoteAddress` fallback may return undefined in some Hono runtimes, causing IP to become `"undefined"` or `"unknown"` | Low | open |

### admin.ts

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| admin.ts | All routes use `authMiddleware -> roleMiddleware("admin") -> ipAllowlistMiddleware` stack as required | — | pass |
| admin.ts | All mutation endpoints (`/bots/:id/kill`, `/referrals/:id/approve-kol`, `/refund`) write to `admin_audit_log` | — | pass |
| admin.ts | `/refund` does not validate `amount <= tx.amount`; admin can over-refund a user | High | open |
| admin.ts | `/refund` does not reverse commission ledger entries per design spec (referrer keeps commission on refunded trade) | High | open |
| admin.ts | `/refund` does not check if transaction was already refunded; allows duplicate refunds | Medium | open |
| admin.ts | `/refund` does not restrict refundable transaction types (e.g., could refund a deposit or another refund) | Medium | open |
| admin.ts | `prisma.$transaction` for refund excludes `adminAuditLog.create`; audit log is non-atomic with the refund | Medium | open |
| admin.ts | `x-forwarded-for` logged directly in `admin_audit_log.ipAddress` without sanitization or proxy validation | Medium | open |
| admin.ts | `/bots/:id/kill` audit log missing `oldValue`/`newValue` fields (only target info) | Low | open |
| admin.ts | `/referrals/:id/approve-kol` hardcodes `oldValue: { tier: "pending_kol" }`; actual prior tier may differ | Low | open |

### encryption.ts

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| encryption.ts | Uses AES-256-GCM with 16-byte random IV and includes authTag | — | pass |
| encryption.ts | `KEY` length is not validated at runtime; a misconfigured env shorter than 32 bytes will cause silent OpenSSL errors or weak keys | Medium | open |
| encryption.ts | No associated data (AAD) bound to ciphertext; acceptable for MVP but limits tamper-context proof | Low | open |

### tier-card.tsx

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| tier-card.tsx | Component is presentational only; tier progression math lives elsewhere. No shared constants file found in repo to validate against | Info | noted |
| tier-card.tsx | `<Progress>` lacks ARIA attributes (`aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`) | Low | open |
| tier-card.tsx | No explicit responsive width constraints; relies on parent grid for layout scaling | Info | noted |

### bot-wizard.tsx

| File | Issue | Severity | Status |
|------|-------|----------|--------|
| bot-wizard.tsx | Uses responsive grid classes (`sm:grid-cols-2`, `sm:grid-cols-3`) | — | pass |
| bot-wizard.tsx | DCA calculator `breakevenPct` compares breakeven to `dropPrice` (initial deviation) instead of the lowest safety-order price reached after all SOs | High | open |
| bot-wizard.tsx | Wizard shows "Bot Created Successfully" but never POSTs to API; bot is not actually created | High | open |
| bot-wizard.tsx | Missing paper/live `mode` selector required by design spec | Medium | open |
| bot-wizard.tsx | DCA review step omits `safetyOrderStepScale`, `safetyOrderVolumeScale`, and `takeProfitTarget` from summary | Low | open |
| bot-wizard.tsx | No parameter validation (e.g., `maxSafetyOrders > 0`, `priceDeviationInitial > 0`) before enabling Next | Low | open |

---

## Security Flags Breakdown

| # | Source | Issue | Severity |
|---|--------|-------|----------|
| 1 | ip-allowlist.ts | `x-forwarded-for` spoofing without trusted proxy validation | High |
| 2 | admin.ts | Refund amount not capped at original transaction amount | High |
| 3 | admin.ts | Commission ledger not reversed on refund | High |
| 4 | bot-wizard.tsx | Wizard completes without API call (functional gap with security impact: no server-side validation of bot config) | High |
| 5 | use-auth.ts | No automatic token refresh (15-min tokens force workarounds) | Medium |
| 6 | admin.ts | Duplicate refund protection missing | Medium |
| 7 | admin.ts | Refund audit log outside transaction | Medium |
| 8 | admin.ts | Audit log IP from spoofable `x-forwarded-for` | Medium |
| 9 | encryption.ts | AES key length not validated at runtime | Medium |

---

## Recommendations

1. **ip-allowlist.ts:** When running behind a load balancer, read the client IP from a trusted header set by the proxy (e.g., `x-real-ip`) and ignore `x-forwarded-for` from untrusted sources. Add CIDR matching for internal network allowlisting.
2. **admin.ts refund:** Validate `amount <= tx.amount`, restrict to `trade_fee` transactions, check for existing refund records, and include `adminAuditLog.create` inside the same `prisma.$transaction`. Reverse the referrer's commission via `commission_ledger` reversal per design spec section 9.3.
3. **bot-wizard.tsx:** Fix DCA breakeven math to use the lowest safety-order price (`basePrice * (1 - finalDeviation/100)`) as the denominator. Wire the "Create Bot" button to a real API POST with Zod-validated DCA config.
4. **use-auth.ts:** Implement a background refresh mechanism that exchanges the refresh token (stored in httpOnly cookie per design spec) before the access token expires.
5. **encryption.ts:** Add a startup assertion that `KEY.length === 32` and throw a descriptive error if the env variable is malformed.
6. **api-client.ts:** Add a `signal` AbortController timeout (e.g., 10s) and wrap `res.json()` in a try/catch with a graceful error fallback.

---

*End of report.*
