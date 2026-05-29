import React, { useMemo, useState } from 'react';
import { Progress } from '../ui/progress';
import { ConfirmModal } from '../ui/confirm-modal';
import { tokens } from '../../styles/design-tokens';

export type BotType = 'signal' | 'dca';
export type Exchange = 'binance' | 'bybit' | 'okx';

export interface DCAConfig {
  initialBaseOrderSize: number;
  safetyOrderSize: number;
  priceDeviationInitial: number;
  maxSafetyOrders: number;
  safetyOrderVolumeScale: number;
  safetyOrderStepScale: number;
  takeProfitTarget: number;
}

const defaultDCA: DCAConfig = {
  initialBaseOrderSize: 100,
  safetyOrderSize: 50,
  priceDeviationInitial: 1.0,
  maxSafetyOrders: 5,
  safetyOrderVolumeScale: 1.5,
  safetyOrderStepScale: 1.2,
  takeProfitTarget: 3.0,
};

const steps = [
  'Choose Bot Type',
  'Connect Exchange',
  'Configure',
  'Review',
];

export const BotWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [botType, setBotType] = useState<BotType | null>(null);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [dca, setDca] = useState<DCAConfig>(defaultDCA);
  const [showConfirm, setShowConfirm] = useState(false);
  const [finished, setFinished] = useState(false);

  const pct = ((step - 1) / (steps.length - 1)) * 100;

  const calculator = useMemo(() => {
    if (botType !== 'dca') return null;
    const deviationPct = dca.priceDeviationInitial;
    const dropFactor = deviationPct / 100;
    const basePrice = 1;
    const dropPrice = basePrice * (1 - dropFactor);

    let totalInvested = dca.initialBaseOrderSize;
    let totalAmount = dca.initialBaseOrderSize / basePrice;

    let currentDeviation = deviationPct;
    let currentOrderSize = dca.safetyOrderSize;

    for (let i = 0; i < dca.maxSafetyOrders; i++) {
      const soPrice = basePrice * (1 - currentDeviation / 100);
      if (soPrice <= 0) break;
      totalInvested += currentOrderSize;
      totalAmount += currentOrderSize / soPrice;
      currentDeviation *= dca.safetyOrderStepScale;
      currentOrderSize *= dca.safetyOrderVolumeScale;
    }

    const breakeven = totalInvested / totalAmount;
    const breakevenPct = ((breakeven - dropPrice) / dropPrice) * 100;

    return {
      dropPct: deviationPct,
      totalInvested,
      breakevenPrice: breakeven,
      breakevenPct: Math.max(0, breakevenPct),
    };
  }, [dca, botType]);

  const canNext =
    (step === 1 && botType !== null) ||
    (step === 2 && exchange !== null) ||
    (step === 3 && botType !== null) ||
    step === 4;

  const handleNext = () => {
    if (step === 4) {
      setShowConfirm(true);
      return;
    }
    setStep((s) => Math.min(steps.length, s + 1));
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    setFinished(true);
  };

  if (finished) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-100">Bot Created Successfully</h3>
        <p className="mt-2 text-sm text-gray-400">Your {botType?.toUpperCase()} bot is now running on {exchange?.toUpperCase()}.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg space-y-6">
      {/* Stepper */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          {steps.map((s, idx) => (
            <span
              key={s}
              className={[
                idx + 1 <= step ? 'text-blue-400 font-medium' : '',
              ].join(' ')}
            >
              {idx + 1}. {s}
            </span>
          ))}
        </div>
        <Progress value={pct} max={100} color={tokens.colors.primary} size="sm" animated />
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { key: 'signal' as BotType, label: 'Signal Bot', desc: 'Execute trades based on external signals' },
            { key: 'dca' as BotType, label: 'DCA Bot', desc: 'Dollar-cost average with safety orders' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setBotType(opt.key)}
              className={[
                'rounded-lg border p-5 text-left transition-all',
                botType === opt.key
                  ? 'border-blue-500 bg-blue-900/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600',
              ].join(' ')}
            >
              <p className="text-base font-semibold text-gray-100">{opt.label}</p>
              <p className="mt-1 text-sm text-gray-400">{opt.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {(['binance', 'bybit', 'okx'] as Exchange[]).map((ex) => (
            <button
              key={ex}
              onClick={() => setExchange(ex)}
              className={[
                'rounded-lg border p-5 text-center transition-all capitalize',
                exchange === ex
                  ? 'border-blue-500 bg-blue-900/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600',
              ].join(' ')}
            >
              <p className="text-base font-semibold text-gray-100">{ex}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && botType === 'dca' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: 'initialBaseOrderSize', label: 'Initial Base Order Size', suffix: 'USDT' },
              { key: 'safetyOrderSize', label: 'Safety Order Size', suffix: 'USDT' },
              { key: 'priceDeviationInitial', label: 'Price Deviation (Initial)', suffix: '%' },
              { key: 'maxSafetyOrders', label: 'Max Safety Orders', suffix: '' },
              { key: 'safetyOrderVolumeScale', label: 'Safety Order Volume Scale', suffix: 'x' },
              { key: 'safetyOrderStepScale', label: 'Safety Order Step Scale', suffix: 'x' },
              { key: 'takeProfitTarget', label: 'Take-Profit Target %', suffix: '%' },
            ].map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="text-sm font-medium text-gray-300">{field.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={field.key.includes('Size') ? 10 : 0.1}
                    value={dca[field.key as keyof DCAConfig]}
                    onChange={(e) =>
                      setDca((prev) => ({
                        ...prev,
                        [field.key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                  />
                  {field.suffix && (
                    <span className="text-sm text-gray-500 w-12">{field.suffix}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Live Calculator */}
          {calculator && (
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Live Calculator Preview
              </p>
              <div className="mt-2 grid gap-2 text-sm text-gray-300 sm:grid-cols-3">
                <div>
                  <span className="text-gray-500">If price drops</span>{' '}
                  <span className="font-semibold text-amber-400">{calculator.dropPct.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Total invested =</span>{' '}
                  <span className="font-semibold text-blue-400">${calculator.totalInvested.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Breakeven =</span>{' '}
                  <span className="font-semibold text-green-400">+{calculator.breakevenPct.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && botType === 'signal' && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 text-center">
          <p className="text-gray-300">Signal bot configuration is handled via webhook/API.</p>
          <p className="mt-2 text-sm text-gray-500">Proceed to review to confirm exchange connection.</p>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-900 p-5">
          <div className="flex justify-between border-b border-gray-700 pb-3">
            <span className="text-sm text-gray-400">Bot Type</span>
            <span className="text-sm font-semibold capitalize text-gray-100">{botType}</span>
          </div>
          <div className="flex justify-between border-b border-gray-700 pb-3">
            <span className="text-sm text-gray-400">Exchange</span>
            <span className="text-sm font-semibold capitalize text-gray-100">{exchange}</span>
          </div>
          {botType === 'dca' && (
            <>
              <div className="flex justify-between border-b border-gray-700 pb-3">
                <span className="text-sm text-gray-400">Initial Order</span>
                <span className="text-sm font-semibold text-gray-100">${dca.initialBaseOrderSize} USDT</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-3">
                <span className="text-sm text-gray-400">Max Safety Orders</span>
                <span className="text-sm font-semibold text-gray-100">{dca.maxSafetyOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Take-Profit</span>
                <span className="text-sm font-semibold text-gray-100">{dca.takeProfitTarget}%</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canNext}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 shadow-lg shadow-blue-900/20"
        >
          {step === 4 ? 'Create Bot' : 'Next'}
        </button>
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Confirm Bot Creation"
        message={`You are about to create a ${botType?.toUpperCase()} bot on ${exchange?.toUpperCase()}. Funds will be used from your exchange wallet. Proceed?`}
        confirmLabel="Create"
        destructive={false}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};

export default BotWizard;
