const fs = require('fs');
const SRC = 'apps/worker/src/engine/dca-loop.ts';
let src = fs.readFileSync(SRC, 'utf8');

// Replace indicator wait returns
src = src.replace(
  /                }\);\n                return;\n              }\n            } catch \(indicatorErr: any\) \{\n              logAlert\(\{\n                botId,\n                message: `Indicator check failed: \$\{indicatorErr\.message}\. Will retry on next tick\.`,\n                metadata: \{ error: indicatorErr\.message \},\n              }\);\n              return;/g,
  `                });\n                continue;\n              }\n            } catch (indicatorErr: any) {\n              logAlert({\n                botId,\n                message: \`Indicator check failed: \${indicatorErr.message}. Will retry on next tick.\`,\n                metadata: { error: indicatorErr.message },\n              });\n              continue;`
);

// Replace safety order skip return
src = src.replace(
  /                logState\(\{\n                  botId,\n                  message: `Safety order skipped: cover indicator not confirmed \(\$\{result\.reason}\)`,\n                  metadata: \{ deviation: nextDeviation, price: lastPrice, vwap: currentState\.vwap\.toString\(\) \},\n                }\);\n                return;/g,
  `                logState({\n                  botId,\n                  message: \`Safety order skipped: cover indicator not confirmed (\${result.reason})\`,\n                  metadata: { deviation: nextDeviation, price: lastPrice, vwap: currentState.vwap.toString() },\n                });\n                continue;`
);

// Division exit full position
src = src.replace(
  /              if \(currentState\.totalAmount\.lessThanOrEqualTo\(0\)\) \{\n                logAlert\(\{ botId, message: "Position fully exited via division tiers\. Stopping bot\." \}\);\n                await stopDcaLoop\(botId\);\n                return;\n              \}/g,
  `              if (currentState.totalAmount.lessThanOrEqualTo(0)) {\n                logAlert({ botId, message: \`[\${direction}] Position fully exited via division tiers.\` });\n                currentState.baseOrderFilled = false;\n                anyStopped = true;\n              }`
);

// Trailing TP exit
src = src.replace(
  /              await prisma\.bot\.update\(\{\n                where: \{ id: botId \},\n                data: \{ status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 \},\n              }\);\n              botStates\.delete\(botId\);\n              await unregisterBot\(botId\);\n              clearInterval\(interval\);\n              clearInterval\(persistInterval\);\n              return;\n            \}\n          \}\n        \}\n\n        \/\/ --- Fixed take-profit \(fallback when trailing is not active\) ---/g,
  `              currentState.baseOrderFilled = false;\n                anyStopped = true;\n              }\n            }\n          }\n\n        // --- Fixed take-profit (fallback when trailing is not active) ---`
);

// Fixed take-profit exit
src = src.replace(
  /            await prisma\.bot\.update\(\{\n              where: \{ id: botId \},\n              data: \{ status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 \},\n            }\);\n            botStates\.delete\(botId\);\n            await unregisterBot\(botId\);\n            clearInterval\(interval\);\n            clearInterval\(persistInterval\);\n            return;\n          \}\n        \}\n\n        \/\/ --- Breakeven stop-loss ---/g,
  `            currentState.baseOrderFilled = false;\n            anyStopped = true;\n          }\n        }\n\n        // --- Breakeven stop-loss ---`
);

// Stop loss exit
src = src.replace(
  /          await prisma\.bot\.update\(\{\n            where: \{ id: botId \},\n            data: \{ status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 \},\n          }\);\n          botStates\.delete\(botId\);\n          await unregisterBot\(botId\);\n          clearInterval\(interval\);\n          clearInterval\(persistInterval\);\n          return;\n        \}\n\n        \/\/ --- Chop-loss \(partial stop-loss\) ---/g,
  `          currentState.baseOrderFilled = false;\n          anyStopped = true;\n        }\n\n        // --- Chop-loss (partial stop-loss) ---`
);

// Chop-loss full position
src = src.replace(
  /              if \(currentState\.totalAmount\.lessThanOrEqualTo\(0\)\) \{\n                logAlert\(\{ botId, message: "Position fully chopped\. Stopping bot\." \}\);\n                await stopDcaLoop\(botId\);\n                return;\n              \}/g,
  `              if (currentState.totalAmount.lessThanOrEqualTo(0)) {\n                logAlert({ botId, message: \`[\${direction}] Position fully chopped.\` });\n                currentState.baseOrderFilled = false;\n                anyStopped = true;\n              }`
);

// Max levels reached
src = src.replace(
  /        if \(currentState\.safetyOrdersFilled >= cfg\.safety_order_max_count\) \{\n          await prisma\.bot\.update\(\{\n            where: \{ id: botId \},\n            data: \{ status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 \},\n          }\);\n          logAlert\(\{\n            botId,\n            message: "Max safety orders reached without profit",\n            metadata: \{\n              maxSafetyOrders: cfg\.safety_order_max_count,\n              totalAmount: currentState\.totalAmount\.toString\(\),\n              vwap: currentState\.vwap\.toString\(\),\n            \},\n          }\);\n          botStates\.delete\(botId\);\n          await unregisterBot\(botId\);\n          clearInterval\(interval\);\n          clearInterval\(persistInterval\);\n          return;\n        \}/g,
  `        if (currentState.safetyOrdersFilled >= cfg.safety_order_max_count) {\n          logAlert({\n            botId,\n            message: \`[\${direction}] Max safety orders reached without profit\`,\n            metadata: {\n              maxSafetyOrders: cfg.safety_order_max_count,\n              totalAmount: currentState.totalAmount.toString(),\n              vwap: currentState.vwap.toString(),\n            },\n          });\n          currentState.baseOrderFilled = false;\n          anyStopped = true;\n        }`
);

// Add positionSide to connector.placeOrder calls in interval body
src = src.replace(
  /                await connector\.placeOrder\(\{\n                  symbol,\n                  side: get(Exit|Entry)Side\(direction\),\n                  type: (orderType|"market"),\n                  amount: (sellAmount|safetyAmount|baseAmount),\n                  (price,\n                  )?reduceOnly: true,\n                }\);/g,
  (match, p1, p2, p3, p4) => {
    const priceLine = p4 ? `                  price,\n` : '';
    return `                await connector.placeOrder({\n                  symbol,\n                  side: get${p1}Side(direction),\n                  type: ${p2},\n                  amount: ${p3},\n${priceLine}                  reduceOnly: true,\n                  positionSide: direction.toUpperCase(),\n                });`;
  }
);

src = src.replace(
  /                await connector\.placeOrder\(\{\n                  symbol,\n                  side: getEntrySide\(direction\),\n                  type: orderType,\n                  amount: baseAmount,\n                  price,\n                }\);/g,
  `                await connector.placeOrder({\n                  symbol,\n                  side: getEntrySide(direction),\n                  type: orderType,\n                  amount: baseAmount,\n                  price,\n                  positionSide: direction.toUpperCase(),\n                });`
);

src = src.replace(
  /                await connector\.placeOrder\(\{\n                  symbol,\n                  side: getEntrySide\(direction\),\n                  type: orderType,\n                  amount: baseAmount,\n                }\);/g,
  `                await connector.placeOrder({\n                  symbol,\n                  side: getEntrySide(direction),\n                  type: orderType,\n                  amount: baseAmount,\n                  positionSide: direction.toUpperCase(),\n                });`
);

src = src.replace(
  /                await connector\.placeOrder\(\{\n                  symbol,\n                  side: getEntrySide\(direction\),\n                  type: orderType,\n                  amount: safetyAmount,\n                  price,\n                }\);/g,
  `                await connector.placeOrder({\n                  symbol,\n                  side: getEntrySide(direction),\n                  type: orderType,\n                  amount: safetyAmount,\n                  price,\n                  positionSide: direction.toUpperCase(),\n                });`
);

src = src.replace(
  /                await connector\.placeOrder\(\{\n                  symbol,\n                  side: getEntrySide\(direction\),\n                  type: orderType,\n                  amount: safetyAmount,\n                }\);/g,
  `                await connector.placeOrder({\n                  symbol,\n                  side: getEntrySide(direction),\n                  type: orderType,\n                  amount: safetyAmount,\n                  positionSide: direction.toUpperCase(),\n                });`
);

// Update risk limits
src = src.replace(
  /if \(cfg\.max_session_loss_usdt && currentState\.sessionRealizedPnl < -cfg\.max_session_loss_usdt\)/g,
  `if (cfg.max_session_loss_usdt && getTotalSessionPnl(botState) < -cfg.max_session_loss_usdt)`
);

src = src.replace(
  /message: `Session loss limit reached: \$\$\{currentState\.sessionRealizedPnl\.toFixed\(2\)} < -\$\$\{cfg\.max_session_loss_usdt}\. Stopping bot\.`,\n              metadata: \{ sessionRealizedPnl: currentState\.sessionRealizedPnl, maxSessionLoss: cfg\.max_session_loss_usdt \},/g,
  `message: \`Session loss limit reached: \$\${getTotalSessionPnl(botState).toFixed(2)} < -\$\${cfg.max_session_loss_usdt}. Stopping bot.\`,\n              metadata: { sessionRealizedPnl: getTotalSessionPnl(botState), maxSessionLoss: cfg.max_session_loss_usdt },`
);

// Add closing of for-loop before catch block
src = src.replace(
  /      } catch \(err: any\) \{/g,
  `      } // end for direction loop\n\n        if (anyStopped) {\n          const bs = botStates.get(botId)!;\n          const allDone =\n            bs.mode === "dual"\n              ? !bs.long.baseOrderFilled && !bs.short.baseOrderFilled\n              : !bs.state.baseOrderFilled;\n          if (allDone) {\n            await prisma.bot.update({\n              where: { id: botId },\n              data: { status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 },\n            });\n            botStates.delete(botId);\n            await unregisterBot(botId);\n            clearInterval(interval);\n            clearInterval(persistInterval);\n            return;\n          }\n        }\n\n      } catch (err: any) {`
);

// Update placeBaseOrder to update BotState correctly
src = src.replace(
  /  botStates\.set\(botId, state\);/g,
  `  const existingBotState = botStates.get(botId);\n  if (existingBotState) {\n    updateDirectionalState(existingBotState, opts.direction, state);\n  } else {\n    botStates.set(botId, { mode: "single", state });\n  }`
);

// Update buildStateJson(state) inside placeBaseOrder and placeSafetyOrder
src = src.replace(
  /stateJson: buildStateJson\(state\) as any,/g,
  `stateJson: buildStateJson(botStates.get(botId)!) as any,`
);

// Add positionSide to placeSafetyOrder
src = src.replace(
  /  const safetyOrder = await connector\.placeOrder\(\{\n    symbol,\n    side: getEntrySide\(state\.direction\),\n    type: orderType,\n    amount: safetyAmount,\n    price,\n  }\);/g,
  `  const safetyOrder = await connector.placeOrder({\n    symbol,\n    side: getEntrySide(state.direction),\n    type: orderType,\n    amount: safetyAmount,\n    price,\n    positionSide: state.direction.toUpperCase(),\n  });`
);

src = src.replace(
  /  const safetyOrder = await connector\.placeOrder\(\{\n    symbol,\n    side: getEntrySide\(state\.direction\),\n    type: orderType,\n    amount: safetyAmount,\n  }\);/g,
  `  const safetyOrder = await connector.placeOrder({\n    symbol,\n    side: getEntrySide(state.direction),\n    type: orderType,\n    amount: safetyAmount,\n    positionSide: state.direction.toUpperCase(),\n  });`
);

// Add positionSide to placeBaseOrder
src = src.replace(
  /  const baseOrder = await connector\.placeOrder\(\{\n    symbol,\n    side: getEntrySide\(direction\),\n    type: orderType,\n    amount: baseAmount,\n    price,\n  }\);/g,
  `  const baseOrder = await connector.placeOrder({\n    symbol,\n    side: getEntrySide(direction),\n    type: orderType,\n    amount: baseAmount,\n    price,\n    positionSide: direction.toUpperCase(),\n  });`
);

src = src.replace(
  /  const baseOrder = await connector\.placeOrder\(\{\n    symbol,\n    side: getEntrySide\(direction\),\n    type: orderType,\n    amount: baseAmount,\n  }\);/g,
  `  const baseOrder = await connector.placeOrder({\n    symbol,\n    side: getEntrySide(direction),\n    type: orderType,\n    amount: baseAmount,\n    positionSide: direction.toUpperCase(),\n  });`
);

// Remove manualCover and scaleOut
const manualCoverRegex = /\/\/ =+\n\/\/ Manual cover\n\/\/ =+\n\nexport async function manualCover[\s\S]*?\n(?=\/\/ =+\n\/\/ Emergency exit)/;
src = src.replace(manualCoverRegex, '');

const scaleOutRegex = /\/\/ =+\n\/\/ Scale out \(partial exit\) — used by API endpoint\n\/\/ =+\n\nexport async function scaleOut[\s\S]*?\n(?=\/\/ =+\n\/\/ Stop)/;
src = src.replace(scaleOutRegex, '');

// Update emergencyExit for dual mode
const emergencyExitRegex = /export async function emergencyExit\(botId: string\): Promise<\{ success: boolean; message: string; pnl\?: number \}> \{[\s\S]*?\n\}\n(?=\/\/ =+\n\/\/ Stop)/;
const newEmergencyExit = `export async function emergencyExit(botId: string): Promise<{ success: boolean; message: string; pnl?: number }> {
  const botState = botStates.get(botId);
  if (!botState) {
    await stopDcaLoop(botId);
    return { success: true, message: "Bot stopped. No active position to exit." };
  }

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { connection: true },
  });
  if (!bot) return { success: false, message: "Bot not found" };

  const cfg = bot.configJson as any;
  const connector = getConnector(bot.connection.exchangeId, bot.mode, botId);
  const symbol = (bot as any).tradingPair || cfg.default_symbol || "BTC/USDT";

  let totalPnl = 0;
  const dirs = botState.mode === "dual" ? (["long", "short"] as const) : ([botState.state.direction] as const);

  for (const dir of dirs) {
    const state = getDirectionalState(botState, dir);
    if (!state || !state.baseOrderFilled) continue;
    const sellAmount = state.totalAmount.toNumber();
    if (sellAmount <= 0) continue;

    const sellOrder = await connector.placeOrder({
      symbol,
      side: getExitSide(dir),
      type: "market",
      amount: sellAmount,
      reduceOnly: true,
      positionSide: dir.toUpperCase(),
    });

    const lastPrice = sellOrder.cost ? sellOrder.cost / sellAmount : 0;
    const sellFee = estimateFee(sellOrder.cost || 0);
    const pnl = calculateRealizedPnl(
      lastPrice || 0,
      sellAmount,
      state.vwap,
      state.totalFees.plus(sellFee),
      dir
    );
    state.sessionRealizedPnl += pnl;
    totalPnl += pnl;

    logAlert({
      botId,
      message: \`Emergency exit [\${dir}] executed at \${lastPrice || 0}. Realized PnL: \$\${pnl.toFixed(4)}\`,
      metadata: {
        exitPrice: lastPrice || 0,
        vwap: state.vwap.toString(),
        totalAmount: state.totalAmount.toString(),
        pnl,
        fees: state.totalFees.plus(sellFee).toString(),
        direction: dir,
      },
    });
  }

  await prisma.bot.update({
    where: { id: botId },
    data: { status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 },
  });

  botStates.delete(botId);
  await unregisterBot(botId);

  const interval = botIntervals.get(botId);
  const persist = botPersistIntervals.get(botId);
  if (interval) { clearInterval(interval); botIntervals.delete(botId); }
  if (persist) { clearInterval(persist); botPersistIntervals.delete(botId); }

  return {
    success: true,
    message: \`Emergency exit completed. Total PnL \$\${totalPnl.toFixed(4)}\`,
    pnl: totalPnl,
  };
}`;

src = src.replace(emergencyExitRegex, newEmergencyExit);

// Clean up extra blank lines
src = src.replace(/\n\n\n+/g, '\n\n');

fs.writeFileSync(SRC, src);
console.log('Done');
