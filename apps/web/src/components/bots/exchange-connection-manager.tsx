import { useState } from "react";
import {
  useExchangeConnections,
  useCreateExchangeConnection,
  useDeleteExchangeConnection,
} from "../../hooks/use-api";
import { useToast } from "../../hooks/use-toast";
import { useI18n } from "../../hooks/use-i18n";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Plug,
  Trash2,
  Plus,
  Globe,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const EXCHANGES = [
  { id: "binance", label: "Binance" },
  { id: "bybit", label: "Bybit" },
  { id: "okx", label: "OKX" },
  { id: "gate", label: "Gate.io" },
  { id: "kucoin", label: "KuCoin" },
  { id: "bitget", label: "Bitget" },
  { id: "mexc", label: "MEXC" },
  { id: "bingx", label: "BingX" },
  { id: "htx", label: "HTX" },
  { id: "bitmart", label: "BitMart" },
];

export function ExchangeConnectionManager() {
  const { t } = useI18n();
  const { data: connections, isLoading } = useExchangeConnections();
  const createConn = useCreateExchangeConnection();
  const deleteConn = useDeleteExchangeConnection();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [exchangeId, setExchangeId] = useState("binance");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createConn.mutateAsync({
        exchangeId,
        name: name || `${EXCHANGES.find((e) => e.id === exchangeId)?.label} Account`,
        apiKey,
        apiSecret,
        passphrase: passphrase || undefined,
      });
      toast.success(t("exchanges.connectedSuccess"));
      setShowForm(false);
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
    } catch (err: any) {
      toast.error(err.message || t("exchanges.connectFailed"));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight flex items-center gap-2">
          <Plug className="w-5 h-5 text-[var(--primary)]" />
          {t("exchanges.title")}
        </h2>
        <Button
          onClick={() => setShowForm((s) => !s)}
          className="gap-1 px-2 py-1 text-[11px] rounded-md"
          variant={showForm ? "secondary" : "primary"}
        >
          {showForm ? t("common.cancel") : (<>
            <Plus className="w-3.5 h-3.5" />
            {t("exchanges.addConnection")}
          </>)}
        </Button>
      </div>

      {showForm && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-card)] p-3">
                <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("common.exchange")}</label>
                <select
                  value={exchangeId}
                  onChange={(e) => setExchangeId(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
                >
                  {EXCHANGES.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.label}</option>
                  ))}
                </select>
              </div>
              <div className="bg-[var(--bg-card)] p-3">
                <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("exchanges.nameOptional")}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("exchanges.namePlaceholder")}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-card)] p-3">
                <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("exchanges.apiKey")}</label>
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t("exchanges.apiKeyPlaceholder")}
                  required
                  className="text-sm"
                />
              </div>
              <div className="bg-[var(--bg-card)] p-3">
                <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("exchanges.apiSecret")}</label>
                <Input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder={t("exchanges.apiSecretPlaceholder")}
                  required
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-card)] p-3">
                <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1.5">{t("exchanges.passphrase")}</label>
                <Input
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={t("exchanges.passphrasePlaceholder")}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={createConn.isPending} className="px-2 py-1 text-[11px] rounded-md">
                {createConn.isPending ? t("exchanges.connecting") : t("exchanges.connectExchange")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <p className="text-[var(--text-muted)] text-sm">{t("exchanges.loadingConnections")}</p>
        </div>
      ) : connections?.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
          <Globe className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm">{t("exchanges.noConnections")}</p>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mt-1">{t("exchanges.addOneToStart")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden">
          {(connections || []).map((conn: any) => (
            <div
              key={conn.id}
              className={`bg-[var(--bg-card)] p-3 relative border-t-2 ${conn.isActive ? "border-[var(--success)]" : "border-[var(--border-subtle)]"}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-['Space_Grotesk'] text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  {conn.name}
                </span>
                <button
                  onClick={() => deleteConn.mutate(conn.id)}
                  className="px-2 py-1 rounded-md text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                  title={t("exchanges.remove")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {conn.isActive ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-[var(--success)]" />
                      <span className="text-[10px] uppercase tracking-widest text-[var(--success)] font-semibold">{t("common.active")}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{t("common.inactive")}</span>
                    </>
                  )}
                </div>
                <span className="text-[var(--border-subtle)]">·</span>
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold capitalize">{conn.exchangeId}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
