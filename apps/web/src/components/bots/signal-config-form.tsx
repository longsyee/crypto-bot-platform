/// <reference types="vite/client" />
import React, { useState, useCallback } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Copy, Check, RefreshCw } from "lucide-react";

export interface SignalConfig {
  webhook_secret?: string;
  default_symbol?: string;
  max_position_size?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
}

interface SignalConfigFormProps {
  config?: SignalConfig;
  botId: string;
  onChange: (config: SignalConfig) => void;
}

export const SignalConfigForm: React.FC<SignalConfigFormProps> = ({
  config,
  botId,
  onChange,
}) => {
  const [copied, setCopied] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3010";
  const webhookUrl = `${API_BASE}/webhooks/signal/${botId}`;

  const handleChange = useCallback(
    (field: keyof SignalConfig, value: any) => {
      const updated = { ...(config || {}), [field]: value };
      onChange(updated);
    },
    [config, onChange]
  );

  const generateSecret = useCallback(() => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const secret = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    handleChange("webhook_secret", secret);
  }, [handleChange]);

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [webhookUrl]);

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
      {/* Webhook URL */}
      <div className="p-4 border-t-2 border-t-[var(--primary)]">
        <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
          Webhook URL
        </label>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-secondary)] font-mono truncate">
            {webhookUrl}
          </code>
          <Button
            variant="secondary"
            size="icon"
            onClick={copyUrl}
            title="Copy URL"
            className="px-2 py-1 text-[11px] rounded-md h-auto w-auto"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[var(--success)]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Webhook Secret */}
      <div className="p-4 border-t border-[var(--border-subtle)] flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Webhook Secret"
            labelClassName="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold"
            containerClassName="gap-1"
            className="font-mono"
            value={config?.webhook_secret ?? ""}
            onChange={(e) =>
              handleChange("webhook_secret", e.target.value)
            }
            placeholder="Auto-generate or paste your secret"
          />
        </div>
        <Button
          variant="secondary"
          onClick={generateSecret}
          className="px-2 py-1 text-[11px] rounded-md gap-1.5 h-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Generate
        </Button>
      </div>

      {/* Default Symbol */}
      <div className="p-4 border-t border-[var(--border-subtle)]">
        <Input
          label="Default Symbol"
          labelClassName="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold"
          containerClassName="gap-1"
          value={config?.default_symbol ?? ""}
          onChange={(e) => handleChange("default_symbol", e.target.value)}
          placeholder="BTC/USDT"
        />
      </div>

      {/* Numeric params */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
        <div className="bg-[var(--bg-card)] p-3">
          <Input
            label="Max Position Size"
            labelClassName="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold"
            containerClassName="gap-1"
            className="font-mono"
            type="number"
            value={config?.max_position_size ?? ""}
            onChange={(e) =>
              handleChange("max_position_size", parseFloat(e.target.value) || 0)
            }
            placeholder="0.0"
          />
        </div>
        <div className="bg-[var(--bg-card)] p-3">
          <Input
            label="Stop Loss %"
            labelClassName="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold"
            containerClassName="gap-1"
            className="font-mono"
            type="number"
            min={0}
            max={100}
            value={config?.stop_loss_pct ?? ""}
            onChange={(e) =>
              handleChange("stop_loss_pct", parseFloat(e.target.value) || 0)
            }
            placeholder="0-100"
          />
        </div>
        <div className="bg-[var(--bg-card)] p-3">
          <Input
            label="Take Profit %"
            labelClassName="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold"
            containerClassName="gap-1"
            className="font-mono"
            type="number"
            min={0}
            max={1000}
            value={config?.take_profit_pct ?? ""}
            onChange={(e) =>
              handleChange("take_profit_pct", parseFloat(e.target.value) || 0)
            }
            placeholder="0-1000"
          />
        </div>
      </div>
    </div>
  );
};

export default SignalConfigForm;
