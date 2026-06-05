const fs = require('fs');
const SRC = 'C:\\Users\\Renaenys\\Desktop\\BOT\\apps\\worker\\src\\engine\\dca-loop.ts';
const lines = fs.readFileSync(SRC, 'utf8').split('\\n');

function findLine(text) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(text)) return i;
  }
  return -1;
}

function replaceRange(startIdx, endIdx, newLines) {
  lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
}

// 1. Replace the indicator wait returns
let idx = findLine('message: `Waiting for ${cfg.indicator_type} signal: ${result.reason}`');
if (idx !== -1) {
  // Find the "return;" after this, which should be a few lines down
  for (let i = idx; i < Math.min(idx + 10, lines.length); i++) {
    if (lines[i].trim() === 'return;' && lines[i].startsWith('                ')) {
      lines[i] = lines[i].replace('return;', 'continue;');
      break;
    }
  }
}

idx = findLine('message: `Indicator check failed: ${indicatorErr.message}. Will retry on next tick.`');
if (idx !== -1) {
  for (let i = idx; i < Math.min(idx + 6, lines.length); i++) {
    if (lines[i].trim() === 'return;' && lines[i].startsWith('              ')) {
      lines[i] = lines[i].replace('return;', 'continue;');
      break;
    }
  }
}

// 2. Replace "Must have base order to proceed" return
idx = findLine('// Must have base order to proceed');
if (idx !== -1 && lines[idx + 1].includes('if (!currentState.baseOrderFilled) return;')) {
  lines[idx + 1] = lines[idx + 1].replace('return;', 'continue;');
}

// 3. Replace safety order skip return
idx = findLine('message: `Safety order skipped: cover indicator not confirmed (${result.reason})`');
if (idx !== -1) {
  for (let i = idx; i < Math.min(idx + 8, lines.length); i++) {
    if (lines[i].trim() === 'return;' && lines[i].startsWith('                  ')) {
      lines[i] = lines[i].replace('return;', 'continue;');
      break;
    }
  }
}

// 4. Find all exit blocks and replace global stop with per-direction stop
// We'll search for specific strings and replace surrounding blocks

// Division exit full position
idx = findLine('Position fully exited via division tiers');
if (idx !== -1) {
  // The block around it is:
  //              if (currentState.totalAmount.lessThanOrEqualTo(0)) {
  //                logAlert({ botId, message: "Position fully exited via division tiers. Stopping bot." });
  //                await stopDcaLoop(botId);
  //                return;
  //              }
  for (let i = idx - 2; i < Math.min(idx + 5, lines.length); i++) {
    if (lines[i].includes('await stopDcaLoop(botId)')) {
      // replace the 3 lines: logAlert, await stopDcaLoop, return
      lines[i - 1] = `                logAlert({ botId, message: \`[\${direction}] Position fully exited via division tiers.\` });`;
      lines[i] = '                currentState.baseOrderFilled = false;';
      lines[i + 1] = '                anyStopped = true;';
      // remove any extra return line
      if (lines[i + 2] && lines[i + 2].trim() === 'return;') {
        lines.splice(i + 2, 1);
      }
      break;
    }
  }
}

// Trailing TP exit
idx = findLine('Trailing TP callback triggered');
if (idx !== -1) {
  // Find the block after logTrade that does global stop
  // It looks like:
  //              await prisma.bot.update({...status: "stopped"...});
  //              botStates.delete(botId);
  //              await unregisterBot(botId);
  //              clearInterval(interval);
  //              clearInterval(persistInterval);
  //              return;
  for (let i = idx; i < Math.min(idx + 30, lines.length); i++) {
    if (lines[i].includes('status: "stopped"') && lines[i].includes('stateJson: null')) {
      // replace from i-1 (await prisma.bot.update opening) to the return
      let end = i;
      while (end < lines.length && !lines[end].trim().startsWith('return;')) end++;
      // Replace the whole block with 2 lines
      const indent = '              ';
      replaceRange(i - 1, end, [
        indent + 'currentState.baseOrderFilled = false;',
        indent + 'anyStopped = true;',
      ]);
      break;
    }
  }
}

// Fixed take-profit exit
idx = findLine('Take profit triggered at');
if (idx !== -1) {
  for (let i = idx; i < Math.min(idx + 30, lines.length); i++) {
    if (lines[i].includes('status: "stopped"') && lines[i].includes('stateJson: null')) {
      let end = i;
      while (end < lines.length && !lines[end].trim().startsWith('return;')) end++;
      const indent = '              ';
      replaceRange(i - 1, end, [
        indent + 'currentState.baseOrderFilled = false;',
        indent + 'anyStopped = true;',
      ]);
      break;
    }
  }
}

// Stop loss exit
idx = findLine('Stop loss triggered (');
if (idx !== -1) {
  for (let i = idx; i < Math.min(idx + 30, lines.length); i++) {
    if (lines[i].includes('status: "stopped"') && lines[i].includes('stateJson: null')) {
      let end = i;
      while (end < lines.length && !lines[end].trim().startsWith('return;')) end++;
      const indent = '              ';
      replaceRange(i - 1, end, [
        indent + 'currentState.baseOrderFilled = false;',
        indent + 'anyStopped = true;',
      ]);
      break;
    }
  }
}

// Chop-loss full position
idx = findLine('Position fully chopped');
if (idx !== -1) {
  for (let i = idx - 2; i < Math.min(idx + 5, lines.length); i++) {
    if (lines[i].includes('await stopDcaLoop(botId)')) {
      lines[i - 1] = `              logAlert({ botId, message: \`[\${direction}] Position fully chopped.\` });`;
      lines[i] = '              currentState.baseOrderFilled = false;';
      lines[i + 1] = '              anyStopped = true;';
      if (lines[i + 2] && lines[i + 2].trim() === 'return;') {
        lines.splice(i + 2, 1);
      }
      break;
    }
  }
}

// Max levels reached
idx = findLine('Max safety orders reached without profit');
if (idx !== -1) {
  for (let i = idx; i < Math.min(idx + 20, lines.length); i++) {
    if (lines[i].includes('status: "stopped"') && lines[i].includes('stateJson: null')) {
      let end = i;
      while (end < lines.length && !lines[end].trim().startsWith('return;')) end++;
      const indent = '          ';
      replaceRange(i - 1, end, [
        indent + 'logAlert({',
        indent + '  botId,',
        indent + '  message: \`[\${direction}] Max safety orders reached without profit\`,',
        indent + '  metadata: {',
        indent + '    maxSafetyOrders: cfg.safety_order_max_count,',
        indent + '    totalAmount: currentState.totalAmount.toString(),',
        indent + '    vwap: currentState.vwap.toString(),',
        indent + '  },',
        indent + '});',
        indent + 'currentState.baseOrderFilled = false;',
        indent + 'anyStopped = true;',
      ]);
      break;
    }
  }
}

// 5. Add `positionSide: direction.toUpperCase()` to connector.placeOrder calls inside the interval
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('await connector.placeOrder({') && l.startsWith('                ')) {
    // Check if the next few lines include reduceOnly (meaning it's an exit)
    // or if it's inside the interval body (base order / safety order / exits)
    // We want to add positionSide to all of them for hedge mode.
    let j = i + 1;
    let foundReduce = false;
    while (j < i + 8 && j < lines.length) {
      if (lines[j].includes('reduceOnly: true')) foundReduce = true;
      if (lines[j].trim() === '});') break;
      j++;
    }
    // Insert positionSide before the closing `});`
    if (lines[j] && lines[j].trim() === '});') {
      lines.splice(j, 0, '                positionSide: direction.toUpperCase(),');
    }
  }
}

// 6. Update risk limits to use total session PnL
idx = findLine('Session loss limit reached');
if (idx !== -1) {
  for (let i = idx; i > Math.max(0, idx - 10); i--) {
    if (lines[i].includes('currentState.sessionRealizedPnl')) {
      lines[i] = lines[i].replace('currentState.sessionRealizedPnl', 'getTotalSessionPnl(botState)');
      break;
    }
  }
}

// 7. Add closing of for-loop before catch block
idx = findLine('} catch (err: any) {');
if (idx !== -1) {
  // Insert before it
  lines.splice(idx, 0, '        } // end for direction loop', '');

  // Add anyStopped handling after the for-loop closing
  const newLines = [
    '        } // end for direction loop',
    '',
    '        if (anyStopped) {',
    '          const bs = botStates.get(botId)!;',
    '          const allDone =',
    '            bs.mode === "dual"',
    '              ? !bs.long.baseOrderFilled && !bs.short.baseOrderFilled',
    '              : !bs.state.baseOrderFilled;',
    '          if (allDone) {',
    '            await prisma.bot.update({',
    '              where: { id: botId },',
    '              data: { status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 },',
    '            });',
    '            botStates.delete(botId);',
    '            await unregisterBot(botId);',
    '            clearInterval(interval);',
    '            clearInterval(persistInterval);',
    '            return;',
    '          }',
    '        }',
    '',
  ];
  lines.splice(idx, 0, ...newLines);
}

// 8. Update placeBaseOrder to update BotState correctly
idx = findLine('botStates.set(botId, state);');
if (idx !== -1) {
  lines[idx] = lines[idx].replace('botStates.set(botId, state);', 'updateDirectionalState(botStates.get(botId)!, opts.direction, state);');
}

// 9. Update buildStateJson(state) inside placeBaseOrder and placeSafetyOrder
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('stateJson: buildStateJson(state) as any,')) {
    lines[i] = lines[i].replace('stateJson: buildStateJson(state) as any,', 'stateJson: buildStateJson(botStates.get(botId)!) as any,');
  }
}

// 10. Add positionSide to placeSafetyOrder
idx = findLine('async function placeSafetyOrder');
if (idx !== -1) {
  for (let i = idx; i < Math.min(idx + 80, lines.length); i++) {
    if (lines[i].trim() === '});' && lines[i - 1] && lines[i - 1].includes('amount: safetyAmount')) {
      lines.splice(i, 0, '    positionSide: state.direction.toUpperCase(),');
      break;
    }
  }
}

// 11. Add positionSide to placeBaseOrder
idx = findLine('async function placeBaseOrder');
if (idx !== -1) {
  for (let i = idx; i < Math.min(idx + 60, lines.length); i++) {
    if (lines[i].trim() === '});' && lines[i - 1] && lines[i - 1].includes('amount: baseAmount')) {
      lines.splice(i, 0, '    positionSide: opts.direction.toUpperCase(),');
      break;
    }
  }
}

// 12. Remove manualCover and scaleOut functions
const manualCoverStart = findLine('export async function manualCover');
const emergencyExitStart = findLine('export async function emergencyExit');
if (manualCoverStart !== -1 && emergencyExitStart !== -1 && manualCoverStart < emergencyExitStart) {
  lines.splice(manualCoverStart - 4, emergencyExitStart - manualCoverStart + 4);
}

const scaleOutStart = findLine('export async function scaleOut');
const stopStart = findLine('export async function stopDcaLoop');
if (scaleOutStart !== -1 && stopStart !== -1 && scaleOutStart < stopStart) {
  lines.splice(scaleOutStart - 4, stopStart - scaleOutStart + 4);
}

// 13. Update emergencyExit for dual mode
const emStart = findLine('export async function emergencyExit');
if (emStart !== -1) {
  // Find the function block and replace it with a new version
  let emEnd = emStart;
  let depth = 0;
  for (let i = emStart; i < lines.length; i++) {
    depth += (lines[i].match(/{/g) || []).length;
    depth -= (lines[i].match(/}/g) || []).length;
    if (depth === 0 && i > emStart) {
      emEnd = i;
      break;
    }
  }
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
  const dirs = botState.mode === "dual" ? ["long", "short"] as const : [botState.state.direction];

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
      message: \`Emergency exit [\${dir}] executed at \${lastPrice || 0}. Realized PnL: $\${pnl.toFixed(4)}\`,
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
    message: \`Emergency exit completed. Total PnL $\${totalPnl.toFixed(4)}\`,
    pnl: totalPnl,
  };
}`;
  replaceRange(emStart, emEnd, newEmergencyExit.split('\\n'));
}

fs.writeFileSync(SRC, lines.join('\\n'));
console.log('Fixes applied');
