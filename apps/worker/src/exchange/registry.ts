import { CCXTConnector } from "./ccxt-connector";
import type { ExchangeConnector } from "./connector";

export function getConnector(
  exchangeId: string,
  mode: "paper" | "live",
  botId?: string
): ExchangeConnector {
  return new CCXTConnector(exchangeId, mode, botId);
}
