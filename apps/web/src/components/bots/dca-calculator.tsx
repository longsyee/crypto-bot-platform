import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";
import { tokens } from "../../styles/design-tokens";
import {
  calculateDCAResult,
  defaultInputs,
  type DCACalculatorInputs,
  type Direction,
  formatRatio,
} from "../../lib/dca-math";
import { cn } from "../../lib/utils";
import { useI18n } from "../../hooks/use-i18n";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  ArrowRight,
  Info,
  Zap,
  ArrowRightLeft,
  Lock,
  Activity,
  Scale,
  Settings2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
//  useCountUp
/* ------------------------------------------------------------------ */
function useCountUp(value: number, duration = 0.8, decimals = 2) {
  const [display, setDisplay] = useState(value);
  const proxyRef = useRef({ val: value });
  const prevValueRef = useRef(value);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = to;

    if (from === to) {
      setDisplay(to);
      return;
    }

    proxyRef.current.val = from;
    const tween = gsap.to(proxyRef.current, {
      val: to,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        setDisplay(proxyRef.current.val);
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, duration]);

  const formatter = useCallback(
    (n: number) => {
      const fixed = n.toFixed(decimals);
      if (decimals <= 2) return fixed;
      return parseFloat(fixed).toString();
    },
    [decimals]
  );

  return formatter(display);
}

/* ------------------------------------------------------------------ */
//  AnimatedNumber
/* ------------------------------------------------------------------ */
const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}> = ({ value, prefix = "", suffix = "", duration = 0.8, decimals = 2, className }) => {
  const text = useCountUp(value, duration, decimals);
  return (
    <span className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
};

/* ------------------------------------------------------------------ */
//  DirectionButton
/* ------------------------------------------------------------------ */
function DirectionButton({
  active,
  dir,
  onClick,
}: {
  active: boolean;
  dir: Direction;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const colors = {
    long: active
      ? "bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30"
      : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]",
    short: active
      ? "bg-[var(--danger)]/20 text-[var(--danger)] border-[var(--danger)]/30"
      : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]",
    both: active
      ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30"
      : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors border",
        colors[dir]
      )}
    >
      {dir === "long" && <TrendingUp className="w-3 h-3 inline mr-1" />}
      {dir === "short" && <TrendingDown className="w-3 h-3 inline mr-1" />}
      {dir === "both" && <ArrowRightLeft className="w-3 h-3 inline mr-1" />}
      {t(`common.${dir}`)}
    </button>
  );
}

/* ------------------------------------------------------------------ */
//  DCACalculator
/* ------------------------------------------------------------------ */
export interface DCACalculatorProps {
  initialValues?: Partial<DCACalculatorInputs>;
  onCreateBot?: (values: DCACalculatorInputs) => void;
  compact?: boolean;
}

export const DCACalculator: React.FC<DCACalculatorProps> = ({
  initialValues,
  onCreateBot,
  compact = false,
}) => {
  const { t } = useI18n();
  const [inputs, setInputs] = useState<DCACalculatorInputs>({
    ...defaultInputs,
    ...initialValues,
  });

  const result = useMemo(() => calculateDCAResult(inputs), [inputs]);

  const resultsPanelRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const barRefs = useRef<HTMLDivElement[]>([]);
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const hasAnimatedIn = useRef(false);

  useEffect(() => {
    if (hasAnimatedIn.current) return;
    hasAnimatedIn.current = true;

    if (resultsPanelRef.current) {
      gsap.from(resultsPanelRef.current, {
        x: 60,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        delay: 0.2,
      });
    }

    if (tableBodyRef.current) {
      const rows = tableBodyRef.current.querySelectorAll("tr");
      gsap.from(rows, {
        y: 20,
        opacity: 0,
        duration: 0.4,
        stagger: 0.04,
        ease: "power2.out",
        delay: 0.1,
      });
    }
  }, []);

  useEffect(() => {
    const maxSize = Math.max(...result.levels.map((l) => l.orderUsdt), 1);
    barRefs.current.forEach((bar, idx) => {
      if (!bar) return;
      const level = result.levels[idx];
      if (!level) return;
      const pct = (level.orderUsdt / maxSize) * 100;
      gsap.to(bar, {
        width: `${Math.max(pct, 0.5)}%`,
        duration: 0.5,
        ease: "power2.out",
      });
    });
  }, [result]);

  const handleInputFocus = useCallback((idx: number) => {
    const el = inputRefs.current[idx];
    if (!el) return;
    gsap.to(el, {
      boxShadow: `0 0 0 3px ${tokens.colors.borderFocus}`,
      duration: 0.2,
      ease: "power2.out",
    });
  }, []);

  const handleInputBlur = useCallback((idx: number) => {
    const el = inputRefs.current[idx];
    if (!el) return;
    gsap.to(el, {
      boxShadow: "0 0 10px rgba(59,130,246,0.1)",
      duration: 0.2,
      ease: "power2.out",
    });
  }, []);

  const updateInput = useCallback(
    <K extends keyof DCACalculatorInputs>(key: K, val: DCACalculatorInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const handleNumberChange = useCallback(
    (key: keyof DCACalculatorInputs, e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      updateInput(key, Number.isNaN(val) ? 0 : val);
    },
    [updateInput]
  );

  const numericFields: {
    key: keyof DCACalculatorInputs;
    label: string;
    suffix?: string;
    step?: string;
    min?: number;
    max?: number;
  }[] = [
    { key: "currentPrice", label: t("calculator.currentPrice"), suffix: "USDT", step: "0.01", min: 0.00000001 },
    { key: "baseOrderSize", label: t("calculator.baseOrderSize"), suffix: "USDT", step: "10", min: 0 },
    { key: "safetyOrderSize", label: t("calculator.safetyOrderSize"), suffix: "USDT", step: "10", min: 0 },
    { key: "priceDeviationInitial", label: t("calculator.firstSafetyTrigger"), suffix: "%", step: "0.1", min: 0 },
    { key: "takeProfit", label: t("calculator.takeProfit"), suffix: "%", step: "0.1", min: 0 },
    { key: "stopLoss", label: t("calculator.stopLoss"), suffix: "%", step: "0.1", min: 0 },
    { key: "maxPositionSize", label: t("calculator.maxPositionCap"), suffix: "USDT", step: "10", min: 0 },
  ];

  const scaleFields: {
    key: keyof DCACalculatorInputs;
    label: string;
    suffix: string;
    step: string;
    min: number;
  }[] = [
    { key: "safetyOrderVolumeScale", label: t("calculator.volumeScale"), suffix: "×", step: "0.01", min: 1 },
    { key: "safetyOrderStepScale", label: t("calculator.stepScale"), suffix: "×", step: "0.01", min: 1 },
  ];

  const isShort = inputs.direction === "short";

  return (
    <div className={cn("flex flex-col gap-4", compact ? "" : "lg:flex-row")}>
      {/* ---------- Inputs Column ---------- */}
      <div className={cn("flex flex-col gap-4", compact ? "w-full" : "w-full lg:w-[420px] flex-shrink-0")}>
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 flex flex-col gap-4 border-t-2 border-[var(--primary)]">
          <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight flex items-center gap-2">
            <Calculator className="w-3.5 h-3.5 text-[var(--primary)]" />
            {t("calculator.parameters")}
          </h3>

          {/* Direction */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("calculator.direction")}
            </label>
            <div className="flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-px">
              {(["long", "short", "both"] as Direction[]).map((d) => (
                <DirectionButton
                  key={d}
                  dir={d}
                  active={inputs.direction === d}
                  onClick={() => updateInput("direction", d)}
                />
              ))}
            </div>
          </div>

          {/* Leverage / Margin */}
          <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-md overflow-hidden border border-[var(--border-subtle)]">
            <div className="bg-[var(--bg-card)] p-3 flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                {t("calculator.leverage")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={125}
                  step={1}
                  value={inputs.leverage}
                  onChange={(e) => handleNumberChange("leverage", e)}
                  className={cn(
                    "w-full rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-mono text-[var(--text-primary)]",
                    "border-[var(--border-subtle)] focus:border-[var(--primary)] focus:outline-none"
                  )}
                />
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  x
                </span>
              </div>
            </div>
            <div className="bg-[var(--bg-card)] p-3 flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                {t("calculator.marginType")}
              </label>
              <div className="flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-px">
                {(["cross", "isolated"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateInput("leverageType", t)}
                    className={cn(
                      "flex-1 rounded-sm px-2 py-1 text-[11px] font-medium capitalize transition-colors border",
                      inputs.leverageType === t
                        ? "bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/30"
                        : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Order Type */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("calculator.orderType")}
            </label>
            <div className="flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-px w-32">
              <button
                onClick={() => updateInput("orderType", "market")}
                className={cn(
                  "flex-1 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors border",
                  inputs.orderType === "market"
                    ? "bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/30"
                    : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
                )}
              >
                {t("calculator.market")}
              </button>
            </div>
          </div>

          {/* Numeric fields */}
          <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
            {numericFields.map((field, idx) => (
              <div
                key={field.key}
                className="bg-[var(--bg-card)] p-3 flex flex-col gap-1 border-t-2 border-transparent focus-within:border-[var(--primary)]"
              >
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  {field.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current[idx] = el;
                    }}
                    type="number"
                    min={field.min}
                    step={field.step}
                    value={inputs[field.key] as number}
                    onChange={(e) => handleNumberChange(field.key, e)}
                    onFocus={() => handleInputFocus(idx)}
                    onBlur={() => handleInputBlur(idx)}
                    className={cn(
                      "w-full rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-mono text-[var(--text-primary)]",
                      "placeholder:text-[var(--text-muted)]",
                      "border-[var(--border-subtle)] focus:border-[var(--primary)] focus:outline-none"
                    )}
                  />
                  {field.suffix && (
                    <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold w-10 text-right">
                      {field.suffix}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Scale fields */}
          <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
            {scaleFields.map((field, idx) => (
              <div
                key={field.key}
                className="bg-[var(--bg-card)] p-3 flex flex-col gap-1 border-t-2 border-transparent focus-within:border-[var(--primary)]"
              >
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  {field.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={field.min}
                    step={field.step}
                    value={inputs[field.key] as number}
                    onChange={(e) => handleNumberChange(field.key, e)}
                    className={cn(
                      "w-full rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-mono text-[var(--text-primary)]",
                      "border-[var(--border-subtle)] focus:border-[var(--primary)] focus:outline-none"
                    )}
                  />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold w-6">
                    {field.suffix}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Max Safety Orders Slider */}
          <Slider
            label={t("calculator.maxSafetyOrders")}
            min={1}
            max={50}
            step={1}
            value={inputs.maxSafetyOrders}
            onChange={(v) => updateInput("maxSafetyOrders", v)}
            valueFormatter={(v) => `${v}`}
            className="pt-2"
          />
        </div>
      </div>

      {/* ---------- Results Column ---------- */}
      <div
        ref={resultsPanelRef}
        className={cn("flex flex-col gap-4 flex-1 min-w-0", compact ? "" : "lg:min-w-[500px]")}
      >
        {/* Summary Banner */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-3 flex flex-wrap items-center gap-3 border-t-2 border-[var(--primary)]">
          <span
            className={cn(
              "text-[10px] uppercase tracking-widest font-semibold",
              isShort ? "text-[var(--danger)]" : "text-[var(--success)]"
            )}
          >
            {inputs.direction} / {inputs.leverage}x {inputs.leverageType}
          </span>
          <div className="h-3 w-px bg-[var(--border-subtle)]" />
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
            {t("calculator.breakEvenLabel")}{" "}
            <span className="text-[var(--text-secondary)] font-mono">
              ${result.breakEvenPrice.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
            {t("calculator.tp")}{" "}
            <span className="text-[var(--success)] font-mono">
              ${result.tpPrice.toFixed(2)}
            </span>
          </div>
          {inputs.stopLoss > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("calculator.sl")}{" "}
              <span className="text-[var(--danger)] font-mono">
                ${result.slPrice.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Analytics */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-[var(--primary)]" />
              {t("calculator.analytics")}
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border-subtle)]">
            <MetricCard
              icon={<Lock className="w-3 h-3" />}
              label={t("calculator.totalMargin")}
              value={result.totalCapitalRequired}
              prefix="$"
              decimals={2}
              accent="var(--primary)"
            />
            <MetricCard
              icon={<Scale className="w-3 h-3" />}
              label={t("calculator.totalNotional")}
              value={result.totalNotional}
              prefix="$"
              decimals={2}
              accent="var(--primary)"
            />
            <MetricCard
              icon={<Target className="w-3 h-3" />}
              label={t("calculator.breakEven")}
              value={result.breakEvenPrice}
              prefix="$"
              decimals={2}
              accent="var(--success)"
            />
            <MetricCard
              icon={<TrendingUp className="w-3 h-3" />}
              label={t("calculator.estProfitAtTp")}
              value={result.estimatedProfitAtTP}
              prefix="$"
              decimals={2}
              valueClassName="text-[var(--success)]"
              accent="var(--success)"
            />
            {inputs.stopLoss > 0 && (
              <MetricCard
                icon={<TrendingDown className="w-3 h-3" />}
                label={t("calculator.estLossAtSl")}
                value={result.estimatedLossAtSL}
                prefix="$"
                decimals={2}
                valueClassName="text-[var(--danger)]"
                accent="var(--danger)"
              />
            )}
            <MetricCard
              icon={<TrendingDown className="w-3 h-3" />}
              label={t("calculator.maxDrawdown")}
              value={result.maxDrawdownPct}
              suffix="%"
              decimals={2}
              valueClassName="text-[var(--danger)]"
              accent="var(--danger)"
            />
            <MetricCard
              icon={<Info className="w-3 h-3" />}
              label={t("calculator.riskReward")}
              value={0}
              customText={formatRatio(result.riskRewardRatio)}
              decimals={2}
              accent="var(--warning)"
            />
            <MetricCard
              icon={<Settings2 className="w-3 h-3" />}
              label={t("calculator.soLevels")}
              value={result.levels.length - 1}
              suffix=""
              decimals={0}
              accent="var(--primary)"
            />
          </div>
        </div>

        {/* Capital Allocation */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden border-t-2 border-[var(--primary)]">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-[var(--primary)]" />
              {t("calculator.capitalAllocation")}
            </h3>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {result.levels.map((level, idx) => {
              const isBase = level.level === 0;
              const label = isBase ? t("calculator.base") : `${t("calculator.so")} ${level.level}`;
              return (
                <div key={level.level} className="flex items-center gap-3 px-4 py-2">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold w-12 text-right font-mono">
                    {label}
                  </span>
                  <div className="flex-1 h-3 bg-[var(--bg-surface)] rounded-sm overflow-hidden">
                    <div
                      ref={(el) => {
                        if (el) barRefs.current[idx] = el;
                      }}
                      className={cn(
                        "h-full",
                        isBase ? "bg-[var(--primary)]" : "bg-[var(--success)]"
                      )}
                      style={{ width: "0%" }}
                    />
                  </div>
                  <span className="font-mono text-xs text-[var(--text-secondary)] w-20 text-right">
                    ${level.orderUsdt.toFixed(2)}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] w-16 text-right">
                    {level.marginRequired.toFixed(2)} mrgn
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Levels Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden border-t-2 border-[var(--primary)]">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h3 className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-[var(--primary)]" />
              {t("calculator.orderLevels")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.level")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.deviation")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.trigger")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.orderUsdt")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.contracts")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.margin")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.cumMargin")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.vwap")}
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                    {t("calculator.tpPrice")}
                  </th>
                  {inputs.stopLoss > 0 && (
                    <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-widest whitespace-nowrap">
                      {t("calculator.slPrice")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody ref={tableBodyRef} className="divide-y divide-[var(--border-subtle)]">
                {result.levels.map((level) => (
                  <tr key={level.level} className="text-[var(--text-primary)]">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {level.level === 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                          {t("calculator.base")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                          {t("calculator.so")} {level.level}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] font-mono whitespace-nowrap">
                      {level.deviationPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] font-mono whitespace-nowrap">
                      ${level.triggerPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] font-mono whitespace-nowrap">
                      ${level.orderUsdt.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] font-mono whitespace-nowrap">
                      {level.contracts.toFixed(6)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] font-mono whitespace-nowrap">
                      ${level.marginRequired.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-primary)] font-mono font-semibold whitespace-nowrap">
                      ${level.cumulativeMargin.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-[var(--warning)] font-mono whitespace-nowrap">
                      ${level.vwap.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-[var(--success)] font-mono whitespace-nowrap">
                      ${level.tpPrice.toFixed(2)}
                    </td>
                    {inputs.stopLoss > 0 && (
                      <td className="px-3 py-2 text-[var(--danger)] font-mono whitespace-nowrap">
                        ${level.slPrice.toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {onCreateBot && (
          <div className="flex justify-end">
            <Button onClick={() => onCreateBot(inputs)} className="gap-1.5 px-3 py-1.5 text-xs rounded-md">
              <Zap className="w-3.5 h-3.5" />
              {t("wizard.createBot")}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
//  MetricCard
/* ------------------------------------------------------------------ */
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  valueClassName?: string;
  customText?: string;
  accent?: string;
}> = ({ icon, label, value, prefix = "", suffix = "", decimals = 2, valueClassName, customText, accent = "var(--primary)" }) => {
  return (
    <div className="bg-[var(--bg-card)] p-3 border-t-2 flex flex-col gap-1" style={{ borderTopColor: accent }}>
      <div className="flex items-center gap-1 text-[var(--text-muted)]">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold">{label}</span>
      </div>
      <div className={cn("font-mono text-xl font-semibold tracking-tight", valueClassName || "text-[var(--text-primary)]")}>
        {customText ? customText : (
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        )}
      </div>
    </div>
  );
};

export default DCACalculator;
