import { CCXTConnector } from "./ccxt-connector";
import { PaperConnector } from "./paper-connector";
import type { ExchangeConnector } from "./connector";

export function getConnector(
  exchangeId: string,
  mode: "paper" | "live"
): ExchangeConnector {
  if (mode === "paper") return new PaperConnector();
  return new CCXTConnector(exchangeId);
}
