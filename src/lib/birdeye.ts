import "server-only";

/**
 * Birdeye API integration for real wallet PnL data.
 * Uses the Wallet PnL Summary endpoint (Solana only).
 *
 * Requires env: BIRDEYE_API_KEY
 */

const BIRDEYE_BASE = "https://public-api.birdeye.so";

export interface BirdeyePnlSummary {
  uniqueTokens: number;
  totalBuy: number;
  totalSell: number;
  totalTrade: number;
  totalWin: number;
  totalLoss: number;
  winRate: number; // 0-1
  totalInvestedUsd: number;
  totalSoldUsd: number;
  currentValueUsd: number;
  realizedProfitUsd: number;
  realizedProfitPercent: number;
  unrealizedUsd: number;
  totalPnlUsd: number;
  avgProfitPerTradeUsd: number;
}

/**
 * Fetch real PnL summary for a single Solana wallet via Birdeye API.
 * Returns null if the API key is missing or the request fails.
 */
export async function fetchBirdeyePnl(walletAddress: string): Promise<BirdeyePnlSummary | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${BIRDEYE_BASE}/wallet/v2/pnl/summary?wallet=${walletAddress}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana",
        "accept": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`[birdeye] Rate limited for ${walletAddress}`);
        return null;
      }
      console.warn(`[birdeye] Failed for ${walletAddress}: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const summary = json?.data?.summary;
    if (!summary) return null;

    return {
      uniqueTokens: summary.unique_tokens ?? 0,
      totalBuy: summary.counts?.total_buy ?? 0,
      totalSell: summary.counts?.total_sell ?? 0,
      totalTrade: summary.counts?.total_trade ?? 0,
      totalWin: summary.counts?.total_win ?? 0,
      totalLoss: summary.counts?.total_loss ?? 0,
      winRate: summary.counts?.win_rate ?? 0,
      totalInvestedUsd: summary.cashflow_usd?.total_invested ?? 0,
      totalSoldUsd: summary.cashflow_usd?.total_sold ?? 0,
      currentValueUsd: summary.cashflow_usd?.current_value ?? 0,
      realizedProfitUsd: summary.pnl?.realized_profit_usd ?? 0,
      realizedProfitPercent: summary.pnl?.realized_profit_percent ?? 0,
      unrealizedUsd: summary.pnl?.unrealized_usd ?? 0,
      totalPnlUsd: summary.pnl?.total_usd ?? 0,
      avgProfitPerTradeUsd: summary.pnl?.avg_profit_per_trade_usd ?? 0,
    };
  } catch (err) {
    console.warn(`[birdeye] Error fetching PnL for ${walletAddress}:`, err);
    return null;
  }
}
