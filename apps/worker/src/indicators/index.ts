export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      sum += values[i];
    } else if (i === period - 1) {
      sum += values[i];
      result.push(sum / period);
    } else {
      result.push(values[i] * k + result[result.length - 1] * (1 - k));
    }
  }
  return result;
}

export function rsi(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  const rsiValues: number[] = new Array(period).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  const firstRs = avgGain / (avgLoss || 1);
  rsiValues.push(100 - 100 / (1 + firstRs));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgGain / (avgLoss || 1);
    rsiValues.push(100 - 100 / (1 + rs));
  }
  return rsiValues;
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < fastEma.length; i++) {
    if (Number.isNaN(fastEma[i]) || Number.isNaN(slowEma[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }
  const signalLineRaw = ema(
    macdLine.filter((v) => !Number.isNaN(v)),
    signal
  );
  const paddedSignal = new Array(macdLine.length - signalLineRaw.length)
    .fill(NaN)
    .concat(signalLineRaw);
  const histogram: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (Number.isNaN(macdLine[i]) || Number.isNaN(paddedSignal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - paddedSignal[i]);
    }
  }
  return { macdLine, signalLine: paddedSignal, histogram };
}

export function emaCrossover(
  closes: number[],
  short = 9,
  long = 21
): { shortEma: number[]; longEma: number[]; cross: ("bull" | "bear" | null)[] } {
  const shortEma = ema(closes, short);
  const longEma = ema(closes, long);
  const cross: ("bull" | "bear" | null)[] = [];
  for (let i = 0; i < shortEma.length; i++) {
    if (Number.isNaN(shortEma[i]) || Number.isNaN(longEma[i])) {
      cross.push(null);
    } else if (i === 0) {
      cross.push(null);
    } else {
      const prevShort = shortEma[i - 1];
      const prevLong = longEma[i - 1];
      const currShort = shortEma[i];
      const currLong = longEma[i];
      if (prevShort <= prevLong && currShort > currLong) {
        cross.push("bull");
      } else if (prevShort >= prevLong && currShort < currLong) {
        cross.push("bear");
      } else {
        cross.push(null);
      }
    }
  }
  return { shortEma, longEma, cross };
}

export function checkIndicatorSignal(
  type: "none" | "rsi" | "macd" | "ema_cross",
  closes: number[],
  params: {
    rsiPeriod?: number;
    rsiThreshold?: number;
    emaShort?: number;
    emaLong?: number;
  }
): { signal: boolean; reason: string } {
  if (type === "none" || closes.length < 10) {
    return {
      signal: true,
      reason: "No indicator configured or insufficient data",
    };
  }

  if (type === "rsi") {
    const period = params.rsiPeriod || 14;
    const threshold = params.rsiThreshold || 30;
    const rsiValues = rsi(closes, period);
    const last = rsiValues[rsiValues.length - 1];
    if (Number.isNaN(last)) {
      return { signal: false, reason: `RSI(${period}) not ready` };
    }
    const triggered = last <= threshold;
    return {
      signal: triggered,
      reason: triggered
        ? `RSI(${period}) = ${last.toFixed(2)} ≤ ${threshold} (oversold)`
        : `RSI(${period}) = ${last.toFixed(2)} > ${threshold}, waiting for oversold`,
    };
  }

  if (type === "macd") {
    const { histogram } = macd(closes);
    const last = histogram[histogram.length - 1];
    const prev = histogram[histogram.length - 2];
    if (Number.isNaN(last) || Number.isNaN(prev)) {
      return { signal: false, reason: "MACD histogram not ready" };
    }
    const triggered = prev <= 0 && last > 0;
    return {
      signal: triggered,
      reason: triggered
        ? `MACD histogram crossed above zero (${prev.toFixed(4)} → ${last.toFixed(4)})`
        : `MACD histogram = ${last.toFixed(4)}, waiting for zero-line cross`,
    };
  }

  if (type === "ema_cross") {
    const short = params.emaShort || 9;
    const long = params.emaLong || 21;
    const { cross } = emaCrossover(closes, short, long);
    const lastCross = cross[cross.length - 1];
    const triggered = lastCross === "bull";
    return {
      signal: triggered,
      reason: triggered
        ? `EMA(${short}) crossed above EMA(${long}) — bullish`
        : `No bullish EMA crossover yet`,
    };
  }

  return {
    signal: true,
    reason: "Unknown indicator type, defaulting to pass",
  };
}
