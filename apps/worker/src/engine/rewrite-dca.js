const fs = require('fs');

const SRC = 'C:\\Users\\Renaenys\\Desktop\\BOT\\apps\\worker\\src\\engine\\dca-loop.ts';
let src = fs.readFileSync(SRC, 'utf8');

// Ensure no trailing extra brace from a bad previous edit
src = src.trimEnd();
if (src.endsWith('}')) {
  // count braces to see if there's an extra one at the very end
  // we can't easily count, but if the last line is just `}` and the line before is also `}`
  const lines = src.split('\\n');
  if (lines[lines.length - 1].trim() === '}' && lines[lines.length - 2].trim() === '}') {
    // remove last line
    lines.pop();
    src = lines.join('\\n');
  }
}

// ============================================================
// 1. Add dual-mode helpers after the existing helpers block
// ============================================================
const helpers = `function getDirectionList(cfg: any): ("long" | "short")[] {
  const d = cfg.direction || "long";
  return d === "both" ? ["long", "short"] : [d];
}

function isDual(cfg: any): boolean {
  return cfg.direction === "both";
}

function getDirectionalState(botState: BotState, dir: "long" | "short"): DirectionalState {
  return botState.mode === "dual" ? botState[dir]! : botState.state;
}

function getTotalSessionPnl(botState: BotState): number {
  if (botState.mode === "dual") {
    return botState.long.sessionRealizedPnl + botState.short.sessionRealizedPnl;
  }
  return botState.state.sessionRealizedPnl;
}

`;

// Insert after `function getBreakevenPrice`
const insertAfter = `function getBreakevenPrice(vwap: Decimal, bufferPct: number, direction: "long" | "short"): Decimal {`;
const breakevenEnd = `}`;
const idx = src.indexOf(insertAfter);
if (idx === -1) throw new Error('getBreakevenPrice not found');
// Find the closing brace of getBreakevenPrice (next line)
let endIdx = src.indexOf(breakevenEnd, idx + insertAfter.length);
// Actually we want after the function body, which ends with a single `}` on its own line
const lines = src.split('\\n');
let insertLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function getBreakevenPrice')) {
    // find the closing brace of this function
    let braceDepth = 0;
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes('{')) braceDepth += (lines[j].match(/{/g) || []).length;
      if (lines[j].includes('}')) braceDepth -= (lines[j].match(/}/g) || []).length;
      if (braceDepth === 0 && j > i) {
        insertLine = j;
        break;
      }
    }
    break;
  }
}
if (insertLine === -1) throw new Error('Could not find end of getBreakevenPrice');
lines.splice(insertLine + 1, 0, '', ...helpers.trim().split('\\n'));
src = lines.join('\\n');

// ============================================================
// 2. Rewrite startDcaLoop signature and top-level vars
// ============================================================
src = src.replace(
  /const direction: "long" \| "short" = cfg\.direction \|\| "long";/,
  `const directions = getDirectionList(cfg);\n    const dual = isDual(cfg);`
);

// ============================================================
// 3. Fix orderType default
// ============================================================
src = src.replace(
  /const orderType = cfg\.order_type === "market" \? "market" : "limit";/,
  `const orderType = cfg.order_type === "limit" ? "limit" : "market";`
);

// ============================================================
// 4. Rewrite state hydration block
// ============================================================
// Old:
// let state: DirectionalState;
// const persisted = bot.stateJson as any;
// if (persisted && persisted.baseOrderFilled) {
//   state = hydrateState(persisted, direction);
//   botStates.set(botId, state);
// } else {
src = src.replace(
  /let state: DirectionalState;\n    const persisted = bot\.stateJson as any;\n    if \(persisted && persisted\.baseOrderFilled\) \{\n      state = hydrateState\(persisted, direction\);\n      botStates\.set\(botId, state\);\n    \} else \{/,
  `let botState: BotState;
    const persisted = bot.stateJson as any;
    if (persisted && (persisted.mode === "dual" || persisted.baseOrderFilled)) {
      botState = hydrateState(persisted);
      botStates.set(botId, botState);
    } else {`
);

// ============================================================
// 5. Rewrite the else block (restart / init logic)
// ============================================================
// We need to replace the big else block that handles existing orders, indicator wait, and first base order.
// This block starts with:
//       // Prevent duplicate base order on worker restart by checking existing orders
//       const existingOrders =
// And ends with:
//         state = botStates.get(botId)!;
//       }
//     }
// (the closing of the else block and the outer if/else)

const oldElseStart = `      // Prevent duplicate base order on worker restart by checking existing orders
      const existingOrders =
        bot.mode === "live"
          ? await prisma.botOrder.findMany({
              where: { botId, side: getEntrySide(direction) },
              orderBy: { createdAt: "asc" },
            })
          : await prisma.paperTrade.findMany({
              where: { botId, side: getEntrySide(direction) },
              orderBy: { createdAt: "asc" },
            });`;

const oldElseEnd = `        state = botStates.get(botId)!;
      }
    }

    // Persist state to DB every 30s`;

const newElseBlock = `      // Prevent duplicate base order on worker restart by checking existing orders
      if (dual) {
        botState = { mode: "dual", long: createEmptyState("long"), short: createEmptyState("short") };
        botStates.set(botId, botState);
        await prisma.bot.update({
          where: { id: botId },
          data: {
            safetyOrdersPlaced: 0,
            stateJson: buildStateJson(botState) as any,
          },
        });
        logState({
          botId,
          message: \`DCA dual-mode bot initialized\`,
          metadata: { direction: "both" },
        });
      } else {
        const direction = directions[0];
        const existingOrders =
          bot.mode === "live"
            ? await prisma.botOrder.findMany({
                where: { botId, side: getEntrySide(direction) },
                orderBy: { createdAt: "asc" },
              })
            : await prisma.paperTrade.findMany({
                where: { botId, side: getEntrySide(direction) },
                orderBy: { createdAt: "asc" },
              });

        if (existingOrders.length > 0) {
          let totalAmount = new Decimal(0);
          let totalCost = new Decimal(0);
          let totalFees = new Decimal(0);
          for (const order of existingOrders) {
            const o = order as any;
            totalAmount = totalAmount.plus(o.filled || o.amount || 0);
            totalCost = totalCost.plus(o.cost || o.totalCost || 0);
            totalFees = totalFees.plus(o.fee || o.simulatedFee || estimateFee(o.cost || 0));
          }
          const state: DirectionalState = {
            direction,
            baseOrderFilled: true,
            safetyOrdersFilled: Math.max(0, existingOrders.length - 1),
            totalAmount,
            totalCost,
            vwap: calculateVwap(totalAmount, totalCost),
            totalFees,
            highestPrice: 0,
            lowestPrice: 0,
            lastSafetyTick: 0,
            tickCount: 0,
            pendingOrders: [],
            priceHistory: [],
            extremePrice: 0,
            sessionRealizedPnl: 0,
            peakEquity: 0,
            chopCount: 0,
            divisionTiersHit: [],
            breakevenTriggered: false,
            waterfallPausedTicks: 0,
            activeTrailingTier: -1,
          };
          botState = { mode: "single", state };
          botStates.set(botId, botState);
          await prisma.bot.update({
            where: { id: botId },
            data: {
              safetyOrdersPlaced: state.safetyOrdersFilled,
              stateJson: buildStateJson(botState) as any,
            },
          });
        } else if (cfg.indicator_type && cfg.indicator_type !== "none") {
          const state = createEmptyState(direction);
          botState = { mode: "single", state };
          botStates.set(botId, botState);
          await prisma.bot.update({
            where: { id: botId },
            data: {
              safetyOrdersPlaced: 0,
              stateJson: buildStateJson(botState) as any,
            },
          });
          logState({
            botId,
            message: \`DCA bot waiting for \${cfg.indicator_type} signal (\${cfg.indicator_timeframe || "1h"}) before first order\`,
            metadata: {
              indicator_type: cfg.indicator_type,
              indicator_timeframe: cfg.indicator_timeframe,
              direction,
            },
          });
        } else {
          await placeBaseOrder({
            botId,
            symbol,
            orderType,
            leverage,
            connector,
            cfg,
            direction,
            lastPrice: 0,
          });
          botState = botStates.get(botId)!;
        }
      }
    }

    // Persist state to DB every 30s`;

const startIdx2 = src.indexOf(oldElseStart);
if (startIdx2 === -1) throw new Error('Could not find old else block start');
const endIdx2 = src.indexOf(oldElseEnd, startIdx2);
if (endIdx2 === -1) throw new Error('Could not find old else block end');
src = src.slice(0, startIdx2) + newElseBlock + src.slice(endIdx2 + oldElseEnd.length);

// ============================================================
// 6. Rewrite persist interval to use botState
// ============================================================
// Replace the interval body that accesses state properties directly
const oldPersist = `    const persistInterval = setInterval(async () => {
      const s = botStates.get(botId);
      if (!s) return;
      await prisma.bot.update({
        where: { id: botId },
        data: { stateJson: buildStateJson(s) as any },
      });
      await prisma.botLog.create({
        data: {
          botId,
          level: "info",
          message: \`DCA state: SO=\${s.safetyOrdersFilled} VWAP=\${s.vwap.toFixed(4)} Fees=$\${s.totalFees.toFixed(4)} PnL=$\${s.sessionRealizedPnl.toFixed(4)}\`,
          metadataJson: {
            totalAmount: s.totalAmount.toString(),
            totalCost: s.totalCost.toString(),
            vwap: s.vwap.toString(),
            totalFees: s.totalFees.toString(),
            sessionRealizedPnl: s.sessionRealizedPnl,
            peakEquity: s.peakEquity,
            chopCount: s.chopCount,
            direction: s.direction,
          },
        },
      });
    }, 30000);`;

const newPersist = `    const persistInterval = setInterval(async () => {
      const s = botStates.get(botId);
      if (!s) return;
      await prisma.bot.update({
        where: { id: botId },
        data: { stateJson: buildStateJson(s) as any },
      });
      const dirStates = s.mode === "dual" ? [s.long, s.short] : [s.state];
      for (const ds of dirStates) {
        if (!ds.baseOrderFilled) continue;
        await prisma.botLog.create({
          data: {
            botId,
            level: "info",
            message: \`DCA [\${ds.direction}]: SO=\${ds.safetyOrdersFilled} VWAP=\${ds.vwap.toFixed(4)} Fees=$\${ds.totalFees.toFixed(4)} PnL=$\${ds.sessionRealizedPnl.toFixed(4)}\`,
            metadataJson: {
              totalAmount: ds.totalAmount.toString(),
              totalCost: ds.totalCost.toString(),
              vwap: ds.vwap.toString(),
              totalFees: ds.totalFees.toString(),
              sessionRealizedPnl: ds.sessionRealizedPnl,
              peakEquity: ds.peakEquity,
              chopCount: ds.chopCount,
              direction: ds.direction,
            },
          },
        });
      }
    }, 30000);`;

src = src.replace(oldPersist, newPersist);

// ============================================================
// 7. Rewrite the main interval loop body to support dual mode
// ============================================================
// We need to wrap the per-direction logic inside a loop.
// The interval starts with:
//     const interval = setInterval(async () => {
//       try {
//         if (!botStates.has(botId)) { ... }
//         botErrorCounts.set(botId, 0);
//
//         const currentState = botStates.get(botId)!;
//         currentState.tickCount++;
//
// And then uses `currentState` as a DirectionalState everywhere.
// We need to replace `currentState` references in the per-direction parts with `dirState`.
// The non-directional parts (funding rate, risk limits) should stay outside.

// This is the most complex replacement. Instead of replacing the entire huge block,
// let's do it with a two-step approach:
//   a) Replace the top of the interval to create a loop
//   b) Replace the bottom (after max levels / error handling) to close the loop

// Step 7a: Replace from `const currentState = botStates.get(botId)!;` through the start of the loop
const oldLoopHeader = `        const currentState = botStates.get(botId)!;
        currentState.tickCount++;`;
const newLoopHeader = `        const botState = botStates.get(botId)!;
        const directions = getDirectionList(cfg);
        let anyStopped = false;

        for (const direction of directions) {
          const currentState = getDirectionalState(botState, direction);
          if (!currentState) continue;
          currentState.tickCount++;`;

src = src.replace(oldLoopHeader, newLoopHeader);

// Now replace all references to `direction` (the outer const) inside the loop body with the loop variable.
// But wait — `direction` was previously a const at the top of `startDcaLoop`. Now it's a loop variable.
// References to `direction` inside the interval body should automatically resolve to the loop variable.
// The only issue is references outside the loop (funding rate check doesn't use direction).

// We need to wrap the end of the loop properly. The loop ends before:
// --- Max levels reached ---
// Actually "Max levels reached" is per-direction.
// And error handling is per-direction too.
// Wait, the error handling `catch (err: any)` is for the whole interval.

// Let's find the section from `// --- Max levels reached ---` to just before `} catch (err: any) {`
// and add a closing brace for the for-loop.

const maxLevelsOld = `        // --- Max levels reached ---
        if (currentState.safetyOrdersFilled >= cfg.safety_order_max_count) {`;

const maxLevelsNew = `        // --- Max levels reached ---
        if (currentState.safetyOrdersFilled >= cfg.safety_order_max_count) {`;
// We need to add `        } // end for direction loop\n` before `      } catch (err: any) {`

const catchBlock = `      } catch (err: any) {`;
const catchIdx = src.indexOf(catchBlock);
if (catchIdx === -1) throw new Error('catch block not found');

// Insert `        } // end for direction loop` before catch block
src = src.slice(0, catchIdx) + `        } // end for direction loop\n\n` + src.slice(catchIdx);

// Also need to fix the `return;` statements inside the loop that should be `continue;` or break the loop appropriately.
// In single mode, `return;` inside the interval stops the tick entirely.
// In dual mode, a `return;` inside the for-loop should be a `continue;` for most cases, except when the whole bot should stop.
// Actually, when TP or SL triggers in single mode, it does:
//   await prisma.bot.update({ status: "stopped" ... });
//   botStates.delete(botId);
//   await unregisterBot(botId);
//   clearInterval(interval);
//   clearInterval(persistInterval);
//   return;
// In dual mode, if one direction hits TP/SL, should we stop the whole bot or just that direction?
// The user wants independent long and short. So if long hits TP, short should continue.
// But the current code structure stops the whole bot. We need to change this.

// Actually, for a futures hedge/dual bot, the two directions are independent.
// If one direction fully exits, the other should keep running.
// But our current code deletes `botStates` and clears intervals.

// For simplicity in this rewrite, let's keep it so that if one direction exits fully,
// we just mark that direction as done but keep the bot running.
// However, if ALL directions are done, then we stop the bot.

// This is getting very complex. Let me think about a simpler approach.

// SIMPLER APPROACH: Write the file from scratch using a template string.
// I'll construct the new file by reading the old one, splitting into sections,
// and reconstructing.

// Actually, the most reliable method is to write the ENTIRE new file using Write.
// I know the full content (1657 lines). I'll write a Node.js script that
// writes the new file piece by piece to avoid tool content limits.

// Wait, I just realized the Write tool content limit is not documented as a specific number of lines,
// but there is a 2000 line read limit. Writing 1657 lines should be fine.

// Let me just construct the new file in memory and write it with Write.
// But I need to be careful about the exact content.

// Hmm, 1657 lines is a lot and the model might truncate.
// Better to use a Node.js script that writes to the file directly.

fs.writeFileSync(SRC + '.new', src);
console.log('Intermediate written to .new');
