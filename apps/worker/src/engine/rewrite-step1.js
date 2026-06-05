const fs = require('fs');
const SRC = 'C:\\Users\\Renaenys\\Desktop\\BOT\\apps\\worker\\src\\engine\\dca-loop.ts';
let src = fs.readFileSync(SRC, 'utf8');

// 1. Add helpers after getBreakevenPrice
const helpers = `
function getDirectionList(cfg: any): ("long" | "short")[] {
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

const beMarker = `function getBreakevenPrice(vwap: Decimal, bufferPct: number, direction: "long" | "short"): Decimal {
  if (direction === "long") {
    return vwap.mul(1 + bufferPct / 100);
  } else {
    return vwap.mul(1 - bufferPct / 100);
  }
}`;

if (!src.includes(beMarker)) throw new Error('beMarker not found');
src = src.replace(beMarker, beMarker + helpers);

// 2. Remove manualCover and scaleOut functions
const manualCoverStart = '// ============================================================\n// Manual cover\n// ============================================================\n\nexport async function manualCover';
const manualCoverEnd = '// ============================================================\n// Emergency exit\n// ============================================================';
const mcStart = src.indexOf(manualCoverStart);
const mcEnd = src.indexOf(manualCoverEnd);
if (mcStart !== -1 && mcEnd !== -1) {
  src = src.slice(0, mcStart) + manualCoverEnd + '\n\n' + src.slice(mcEnd + manualCoverEnd.length);
}

const scaleOutStart = '// ============================================================\n// Scale out (partial exit) — used by API endpoint\n// ============================================================\n\nexport async function scaleOut';
const scaleOutEnd = '// ============================================================\n// Stop\n// ============================================================';
const soStart = src.indexOf(scaleOutStart);
const soEnd = src.indexOf(scaleOutEnd);
if (soStart !== -1 && soEnd !== -1) {
  src = src.slice(0, soStart) + scaleOutEnd + '\n\n' + src.slice(soEnd + scaleOutEnd.length);
}

// 3. Fix orderType default
src = src.replace(
  'const orderType = cfg.order_type === "market" ? "market" : "limit";',
  'const orderType = cfg.order_type === "limit" ? "limit" : "market";'
);

// 4. Rewrite top of startDcaLoop: direction -> directions + dual
src = src.replace(
  'const direction: "long" | "short" = cfg.direction || "long";',
  'const directions = getDirectionList(cfg);\n    const dual = isDual(cfg);'
);

// 5. Rewrite persisted state hydration
src = src.replace(
  /let state: DirectionalState;\n    const persisted = bot\.stateJson as any;\n    if \(persisted && persisted\.baseOrderFilled\) \{\n      state = hydrateState\(persisted, direction\);\n      botStates\.set\(botId, state\);\n    \} else \{/,
  `let botState: BotState;
    const persisted = bot.stateJson as any;
    if (persisted && (persisted.mode === "dual" || persisted.baseOrderFilled)) {
      botState = hydrateState(persisted);
      botStates.set(botId, botState);
    } else {`
);

// 6. Rewrite the else block (existing orders / init)
const oldElseBlock = `      // Prevent duplicate base order on worker restart by checking existing orders
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
        state = {
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
        botStates.set(botId, state);
        await prisma.bot.update({
          where: { id: botId },
          data: {
            safetyOrdersPlaced: state.safetyOrdersFilled,
            stateJson: buildStateJson(state) as any,
          },
        });
      } else if (cfg.indicator_type && cfg.indicator_type !== "none") {
        state = createEmptyState(direction);
        botStates.set(botId, state);
        await prisma.bot.update({
          where: { id: botId },
          data: {
            safetyOrdersPlaced: 0,
            stateJson: buildStateJson(state) as any,
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
          lastPrice: 0, // will fetch ticker inside
        });
        state = botStates.get(botId)!;
      }
    }`;

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
            lastPrice: 0, // will fetch ticker inside
          });
          botState = botStates.get(botId)!;
        }
      }`;

if (!src.includes(oldElseBlock)) {
  console.error('Could not find old else block. Writing debug.');
  fs.writeFileSync(SRC + '.debug-old.txt', oldElseBlock);
  process.exit(1);
}
src = src.replace(oldElseBlock, newElseBlock);

// 7. Rewrite persist interval
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

// 8. Rewrite the core interval loop header
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

// 9. Change the `return` inside indicator wait to `continue`
src = src.replace(
  /} else \{\n                  logState\(\{\n                    botId,\n                    message: \`Waiting for \${cfg\.indicator_type} signal: \${result\.reason}\`,\n                    metadata: \{\n                      indicator: cfg\.indicator_type,\n                      timeframe: cfg\.indicator_timeframe,\n                      reason: result\.reason,\n                      price: lastPrice,\n                    \},\n                  \}\);\n                  return;\n                \}/,
  `} else {
                  logState({
                    botId,
                    message: \`Waiting for \${cfg.indicator_type} signal: \${result.reason}\`,
                    metadata: {
                      indicator: cfg.indicator_type,
                      timeframe: cfg.indicator_timeframe,
                      reason: result.reason,
                      price: lastPrice,
                    },
                  });
                  continue;
                }`
);

src = src.replace(
  /} catch \(indicatorErr: any\) \{\n              logAlert\(\{\n                botId,\n                message: \`Indicator check failed: \${indicatorErr\.message}\. Will retry on next tick\.\`,\n                metadata: \{ error: indicatorErr\.message \},\n              \}\);\n              return;\n            \}/,
  `} catch (indicatorErr: any) {
              logAlert({
                botId,
                message: \`Indicator check failed: \${indicatorErr.message}. Will retry on next tick.\`,
                metadata: { error: indicatorErr.message },
              });
              continue;
            }`
);

// 10. Replace "if (!currentState.baseOrderFilled) return;" with continue
src = src.replace(
  '        // Must have base order to proceed\n        if (!currentState.baseOrderFilled) return;',
  '        // Must have base order to proceed\n        if (!currentState.baseOrderFilled) continue;'
);

// 11. Replace safety order skip return with continue
src = src.replace(
  /                  logState\(\{\n                    botId,\n                    message: \`Safety order skipped: cover indicator not confirmed \(\${result\.reason}\)\`,\n                    metadata: \{ deviation: nextDeviation, price: lastPrice, vwap: currentState\.vwap\.toString\(\) \},\n                  \}\);\n                  return;\n                \}/,
  `                  logState({
                    botId,
                    message: \`Safety order skipped: cover indicator not confirmed (\${result.reason})\`,
                    metadata: { deviation: nextDeviation, price: lastPrice, vwap: currentState.vwap.toString() },
                  });
                  continue;
                }`
);

// 12. Wrap exits so they mark direction as stopped instead of global stop
// Division exit full position
src = src.replace(
  /              if \(currentState\.totalAmount\.lessThanOrEqualTo\(0\)\) \{\n                logAlert\(\{ botId, message: "Position fully exited via division tiers\. Stopping bot\." \}\);\n                await stopDcaLoop\(botId\);\n                return;\n              \}/,
  `              if (currentState.totalAmount.lessThanOrEqualTo(0)) {
                logAlert({ botId, message: \`[\${direction}] Position fully exited via division tiers.\` });
                currentState.baseOrderFilled = false;
                anyStopped = true;
              }`
);

// Trailing TP exit
src = src.replace(
  /              await prisma\.bot\.update\(\{\n                where: \{ id: botId \},\n                data: \{ status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 \},\n              \}\);\n              botStates\.delete\(botId\);\n              await unregisterBot\(botId\);\n              clearInterval\(interval\);\n              clearInterval\(persistInterval\);\n              return;\n            \}\n          \}\n        \}\n\n        \/\/ --- Fixed take-profit \(fallback when trailing is not active\) ---/,
  `              currentState.baseOrderFilled = false;
                anyStopped = true;
              }
            }
          }

        // --- Fixed take-profit (fallback when trailing is not active) ---`
);

// Wait, the above is too fragile because of whitespace variations.
// Let me use a more targeted approach: find "Position fully exited via division tiers" and replace surrounding block.

// Let's write out the transformed file and then manually fix remaining issues.
fs.writeFileSync(SRC + '.step1.ts', src);
console.log('Step 1 written to .step1.ts');
