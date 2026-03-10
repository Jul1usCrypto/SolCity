import "server-only";
import { fetchBirdeyePnl } from "./birdeye";

/**
 * Solana wallet data fetching via Helius API + Birdeye PnL.
 * Computes wallet metrics used to generate SolCity buildings.
 *
 * Requires env: HELIUS_API_KEY, BIRDEYE_API_KEY (optional)
 */

const HELIUS_BASE = "https://mainnet.helius-rpc.com";
const HELIUS_API = "https://api.helius.xyz/v0";
const LAMPORTS_PER_SOL = 1_000_000_000;

function heliusRpcUrl() {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY not set");
  return `${HELIUS_BASE}/?api-key=${key}`;
}

function heliusApiUrl(path: string) {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY not set");
  return `${HELIUS_API}${path}?api-key=${key}`;
}

/* ─── Types ────────────────────────────────────────────────── */

export interface WalletMetrics {
  address: string;
  name?: string;
  solBalance: number;
  totalTransactions: number;
  tokenCount: number;
  nftCount: number;
  volumeEstimate: number;
  swapCount: number;
  uniqueTokensTraded: number;
  // PnL & trading metrics (real from Birdeye when available, estimated otherwise)
  pnlUsd: number;        // total PnL in USD (realized + unrealized)
  realizedPnlUsd: number; // realized profit in USD
  winRate: number;        // 0-1 ratio
  totalTrades: number;    // buy + sell count from Birdeye
  avgHoldTime: string;
  rugsSurvived: number;
  degenScore: number;
  pnlIsReal: boolean;     // true = Birdeye data, false = estimated
  // City params
  citySize: number;       // from volume
  skyscraperHeight: number; // from PnL
  buildingCount: number;  // from trades
  districtCount: number;  // from token diversity
  hasNeonDistrict: boolean; // meme coin trader
  parkCount: number;      // from long holds
}

export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }[];
  description?: string;
}

/* ─── RPC Helpers ──────────────────────────────────────────── */

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(heliusRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

/* ─── Fetch SOL balance ────────────────────────────────────── */

async function getBalance(address: string): Promise<number> {
  const result = await rpcCall("getBalance", [address]);
  return (result?.value ?? 0) / LAMPORTS_PER_SOL;
}

/* ─── Fetch transaction signatures (count) ─────────────────── */

async function getSignatureCount(address: string): Promise<number> {
  // Fetch up to 1000 signatures to get a count. For wallets with more,
  // we paginate up to a few pages for a reasonable estimate.
  let total = 0;
  let before: string | undefined;
  const MAX_PAGES = 5; // 5 * 1000 = 5000 max counted

  for (let page = 0; page < MAX_PAGES; page++) {
    const params: Record<string, unknown> = { limit: 1000 };
    if (before) params.before = before;

    const sigs = await rpcCall("getSignaturesForAddress", [address, params]);
    if (!sigs || sigs.length === 0) break;
    total += sigs.length;
    if (sigs.length < 1000) break;
    before = sigs[sigs.length - 1].signature;
  }

  return total;
}

/* ─── Fetch parsed transaction history from Helius ─────────── */

async function getTransactionHistory(address: string): Promise<HeliusTransaction[]> {
  const url = heliusApiUrl(`/addresses/${address}/transactions`);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    // Fallback to empty if rate-limited
    if (res.status === 429) return [];
    throw new Error(`Helius transactions failed: ${res.status}`);
  }
  return res.json();
}

/* ─── Fetch token holdings ─────────────────────────────────── */

async function getTokenAccounts(address: string): Promise<{ fungibleCount: number; nftCount: number }> {
  try {
    const result = await rpcCall("getTokenAccountsByOwner", [
      address,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]);

    const accounts = result?.value ?? [];
    let fungibleCount = 0;
    let nftCount = 0;

    for (const acc of accounts) {
      const info = acc?.account?.data?.parsed?.info;
      if (!info) continue;
      const amount = parseFloat(info.tokenAmount?.uiAmountString ?? "0");
      if (amount <= 0) continue;
      const decimals = info.tokenAmount?.decimals ?? 0;
      if (decimals === 0 && amount === 1) {
        nftCount++;
      } else {
        fungibleCount++;
      }
    }

    return { fungibleCount, nftCount };
  } catch {
    return { fungibleCount: 0, nftCount: 0 };
  }
}

/* ─── Compute metrics from transaction history ─────────────── */

function computeMetricsFromTxs(txs: HeliusTransaction[]) {
  let swapCount = 0;
  const uniqueTokens = new Set<string>();
  let totalVolumeLamports = 0;

  for (const tx of txs) {
    const type = tx.type?.toUpperCase() ?? "";

    // Count swaps
    if (type === "SWAP" || type === "TOKEN_MINT" || type.includes("SWAP")) {
      swapCount++;
    }

    // Track unique tokens
    if (tx.tokenTransfers) {
      for (const tt of tx.tokenTransfers) {
        if (tt.mint) uniqueTokens.add(tt.mint);
      }
    }

    // Estimate volume from native transfers
    if (tx.nativeTransfers) {
      for (const nt of tx.nativeTransfers) {
        totalVolumeLamports += Math.abs(nt.amount);
      }
    }
  }

  return {
    swapCount,
    uniqueTokensTraded: uniqueTokens.size,
    volumeEstimate: totalVolumeLamports / LAMPORTS_PER_SOL,
  };
}

/* ─── Derive city parameters from metrics ──────────────────── */

function deriveCityParams(metrics: {
  totalTransactions: number;
  volumeEstimate: number;
  swapCount: number;
  uniqueTokensTraded: number;
  tokenCount: number;
}) {
  const vol = metrics.volumeEstimate;
  const txs = metrics.totalTransactions;
  const tokens = metrics.uniqueTokensTraded;

  // City size: 1-5 scale based on volume
  const citySize = Math.min(5, Math.max(1, Math.ceil(Math.log10(Math.max(vol, 1)))));

  // Skyscraper height: based on volume (proxy for PnL since real PnL needs price data)
  const skyscraperHeight = Math.min(100, Math.max(5, Math.floor(vol / 10)));

  // Building count: from total transactions
  const buildingCount = Math.min(200, Math.max(5, Math.floor(txs / 25)));

  // District count: from unique tokens
  const districtCount = Math.min(8, Math.max(1, Math.ceil(tokens / 5)));

  // Neon district: if traded many meme-style tokens (>10 unique tokens = degen)
  const hasNeonDistrict = tokens > 10;

  // Parks: fewer swaps relative to txs = hodler
  const holdRatio = txs > 0 ? 1 - (metrics.swapCount / txs) : 0;
  const parkCount = Math.max(0, Math.floor(holdRatio * 5));

  return { citySize, skyscraperHeight, buildingCount, districtCount, hasNeonDistrict, parkCount };
}

/* ─── Estimate fun metrics ─────────────────────────────────── */

function estimateFunMetrics(txs: HeliusTransaction[], totalTxs: number, uniqueTokens: number) {
  // PnL estimate: seeded pseudo-random in a realistic SOL range
  // In production, you'd use Birdeye/Nansen for real PnL
  const seed = totalTxs * 7 + uniqueTokens * 13;
  const raw = (seed % 1000) - 200; // -200 to +800 SOL range
  const pnlEstimate = Math.floor(raw * (1 + (uniqueTokens % 5) * 0.3));

  // Win rate: roughly based on swap diversity
  const winRate = Math.min(85, Math.max(25, 40 + (uniqueTokens % 45)));

  // Avg hold time: based on transaction frequency
  const avgMinutes = totalTxs > 100 ? 15 + (totalTxs % 300) : 60 + (totalTxs % 1440);
  const hours = Math.floor(avgMinutes / 60);
  const mins = avgMinutes % 60;
  const avgHoldTime = `${hours}h ${mins}m`;

  // Rugs survived: roughly 1 per 3 unique tokens
  const rugsSurvived = Math.max(0, Math.floor(uniqueTokens / 3));

  // Degen score: 0-100 based on activity volume
  const degenScore = Math.min(100, Math.max(10,
    Math.floor((totalTxs / 50) + (uniqueTokens * 2) + (winRate > 50 ? 15 : 0))
  ));

  return { pnlEstimate, winRate, avgHoldTime, rugsSurvived, degenScore };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT: Fetch all wallet metrics
   ═══════════════════════════════════════════════════════════════ */

export async function fetchWalletMetrics(address: string, name?: string): Promise<WalletMetrics> {
  // Run independent calls in parallel (Helius + Birdeye)
  const [balance, totalTransactions, tokens, txHistory, birdeyePnl] = await Promise.all([
    getBalance(address),
    getSignatureCount(address),
    getTokenAccounts(address),
    getTransactionHistory(address),
    fetchBirdeyePnl(address),
  ]);

  const txMetrics = computeMetricsFromTxs(txHistory);

  // Use real Birdeye data if available, fall back to estimation
  let pnlUsd: number;
  let realizedPnlUsd: number;
  let winRate: number;
  let totalTrades: number;
  let degenScore: number;
  let pnlIsReal: boolean;
  let uniqueTokens = txMetrics.uniqueTokensTraded;

  if (birdeyePnl) {
    pnlUsd = birdeyePnl.totalPnlUsd;
    realizedPnlUsd = birdeyePnl.realizedProfitUsd;
    winRate = birdeyePnl.winRate;
    totalTrades = birdeyePnl.totalTrade;
    uniqueTokens = Math.max(uniqueTokens, birdeyePnl.uniqueTokens);
    pnlIsReal = true;
    // Degen score from real metrics: trade volume + win consistency + token diversity
    degenScore = Math.min(100, Math.max(10, Math.floor(
      Math.min(40, totalTrades / 500) +
      Math.min(30, uniqueTokens / 50) +
      (winRate > 0.5 ? 20 : winRate > 0.4 ? 10 : 5) +
      (Math.abs(pnlUsd) > 100000 ? 10 : Math.abs(pnlUsd) > 10000 ? 5 : 0)
    )));
  } else {
    const est = estimateFunMetrics(txHistory, totalTransactions, uniqueTokens);
    pnlUsd = est.pnlEstimate; // fallback: fake estimate
    realizedPnlUsd = est.pnlEstimate;
    winRate = est.winRate / 100; // normalize old 25-85 range to 0-1
    totalTrades = totalTransactions;
    degenScore = est.degenScore;
    pnlIsReal = false;
  }

  // Avg hold time & rugs survived (still estimated — no API for these)
  const avgMinutes = totalTransactions > 100 ? 15 + (totalTransactions % 300) : 60 + (totalTransactions % 1440);
  const avgHoldTime = `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`;
  const rugsSurvived = Math.max(0, Math.floor(uniqueTokens / 3));

  const cityParams = deriveCityParams({
    totalTransactions,
    volumeEstimate: txMetrics.volumeEstimate,
    swapCount: txMetrics.swapCount,
    uniqueTokensTraded: uniqueTokens,
    tokenCount: tokens.fungibleCount,
  });

  return {
    address,
    name,
    solBalance: balance,
    totalTransactions,
    tokenCount: tokens.fungibleCount,
    nftCount: tokens.nftCount,
    volumeEstimate: txMetrics.volumeEstimate,
    swapCount: txMetrics.swapCount,
    uniqueTokensTraded: uniqueTokens,
    pnlUsd,
    realizedPnlUsd,
    winRate,
    totalTrades,
    avgHoldTime,
    rugsSurvived,
    degenScore,
    pnlIsReal,
    ...cityParams,
  };
}
