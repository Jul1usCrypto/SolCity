import { NextResponse } from "next/server";
import { KOL_WALLETS } from "@/lib/kol-wallets";
import { fetchWalletMetrics, type WalletMetrics } from "@/lib/solana";

// In-memory cache for seed data (refreshes every 10 min)
let cachedSeed: WalletMetrics[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  // If no Helius key, return mock data so the city still works
  if (!process.env.HELIUS_API_KEY) {
    return NextResponse.json(generateMockSeed());
  }

  // Return cached if fresh
  if (cachedSeed && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedSeed);
  }

  try {
    // Fetch all KOL wallets in smaller chunks to reduce rate-limit failures.
    const CHUNK_SIZE = 8;
    const liveByAddress = new Map<string, WalletMetrics>();

    for (let i = 0; i < KOL_WALLETS.length; i += CHUNK_SIZE) {
      const chunk = KOL_WALLETS.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((kol) => fetchWalletMetrics(kol.address, kol.name))
      );

      let fulfilled = 0;
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          liveByAddress.set(chunk[idx].address, result.value);
          fulfilled++;
        }
      });
      console.log(`[seed] Chunk ${Math.floor(i/CHUNK_SIZE)+1}: ${fulfilled}/${chunk.length} wallets fetched`);

      // Small delay between chunks to avoid Birdeye rate limits
      if (i + CHUNK_SIZE < KOL_WALLETS.length) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    console.log(`[seed] Total live: ${liveByAddress.size}/${KOL_WALLETS.length}`);

    // Keep ordering stable and fill failed live fetches with deterministic mocks.
    const metrics: WalletMetrics[] = KOL_WALLETS.map((kol) => {
      return liveByAddress.get(kol.address) ?? generateMockWallet(kol.address, kol.name);
    });

    if (metrics.length > 0) {
      cachedSeed = metrics;
      cacheTime = Date.now();
    }

    return NextResponse.json(metrics.length > 0 ? metrics : generateMockSeed(), {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (err) {
    console.error("[city/seed] Error:", err);
    return NextResponse.json(generateMockSeed());
  }
}

/** Mock seed data so the city renders even without Helius key */
function generateMockSeed() {
  return KOL_WALLETS.map((kol) => generateMockWallet(kol.address, kol.name));
}

function generateMockWallet(address: string, name?: string): WalletMetrics {
  const seed = hashCode(address);
  const totalTx = 500 + Math.abs(seed % 15000);
  const vol = 10 + Math.abs((seed * 7) % 50000);
  const tokens = 5 + Math.abs((seed * 3) % 80);
  const swaps = Math.floor(totalTx * 0.4);

  // Wider realistic PnL range: -$50K to +$200K USD
  const rawPnl = ((seed * 13) % 250000) - 50000;
  const mockPnl = rawPnl + (Math.abs((seed * 31) % 80000) * (seed % 2 === 0 ? 1 : -0.3));

  return {
    address,
    name,
    solBalance: 0.5 + Math.abs((seed * 11) % 500),
    totalTransactions: totalTx,
    tokenCount: tokens,
    nftCount: Math.abs((seed * 5) % 20),
    volumeEstimate: vol,
    swapCount: swaps,
    uniqueTokensTraded: tokens,
    pnlUsd: mockPnl,
    realizedPnlUsd: mockPnl * 0.7,
    winRate: (30 + Math.abs((seed * 17) % 55)) / 100, // 0-1 range
    totalTrades: totalTx,
    avgHoldTime: `${1 + Math.abs((seed * 2) % 48)}h ${Math.abs((seed * 3) % 60)}m`,
    rugsSurvived: Math.floor(tokens / 3),
    degenScore: 20 + Math.abs((seed * 19) % 80),
    pnlIsReal: false,
    citySize: Math.min(5, Math.max(1, Math.ceil(Math.log10(Math.max(vol, 1))))),
    skyscraperHeight: Math.min(100, Math.max(5, Math.floor(vol / 10))),
    buildingCount: Math.min(200, Math.max(5, Math.floor(totalTx / 25))),
    districtCount: Math.min(8, Math.max(1, Math.ceil(tokens / 5))),
    hasNeonDistrict: tokens > 10,
    parkCount: Math.max(0, Math.floor((1 - swaps / totalTx) * 5)),
  };
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}
