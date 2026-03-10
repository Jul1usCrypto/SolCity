import { NextResponse } from "next/server";
import { KOL_WALLETS } from "@/lib/kol-wallets";
import { fetchWalletMetrics, type WalletMetrics } from "@/lib/solana";

// ─── Static snapshot: hardcoded seed data for instant load ───
import SEED_SNAPSHOT from "@/data/seed-snapshot.json";

// In-memory live cache (populated by background refresh)
let liveCache: WalletMetrics[] | null = null;
let liveCacheTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let refreshInProgress = false;

export async function GET() {
  // 1) If we have a fresh live cache, serve it
  if (liveCache && Date.now() - liveCacheTime < CACHE_TTL) {
    return NextResponse.json(liveCache, { headers: cacheHeaders() });
  }

  // 2) Serve the static snapshot IMMEDIATELY, then kick off background refresh
  if (!refreshInProgress && process.env.HELIUS_API_KEY) {
    refreshInProgress = true;
    refreshSeedData().finally(() => { refreshInProgress = false; });
  }

  // Return live cache if available (even if stale), otherwise static snapshot
  return NextResponse.json(liveCache ?? SEED_SNAPSHOT, { headers: cacheHeaders() });
}

function cacheHeaders() {
  return { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };
}

// ─── Background refresh: fetches live data without blocking the response ───
async function refreshSeedData() {
  try {
    const CHUNK_SIZE = 8;
    const CHUNK_DELAY_MS = 500;
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
      console.log(`[seed] Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${fulfilled}/${chunk.length} wallets fetched`);

      if (i + CHUNK_SIZE < KOL_WALLETS.length) {
        await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
      }
    }

    console.log(`[seed] Background refresh done: ${liveByAddress.size}/${KOL_WALLETS.length} live`);

    // Merge: use live data where available, fall back to snapshot entry
    const snapshotMap = new Map((SEED_SNAPSHOT as WalletMetrics[]).map(w => [w.address, w]));
    const merged: WalletMetrics[] = KOL_WALLETS.map((kol) => {
      return liveByAddress.get(kol.address) ?? snapshotMap.get(kol.address) ?? (SEED_SNAPSHOT as WalletMetrics[])[0];
    });

    if (merged.length > 0) {
      liveCache = merged;
      liveCacheTime = Date.now();
    }
  } catch (err) {
    console.error("[seed] Background refresh error:", err);
  }
}
