import { NextRequest, NextResponse } from "next/server";
import { fetchWalletMetrics } from "@/lib/solana";
import { KOL_WALLETS } from "@/lib/kol-wallets";

// Validate Solana address (base58, 32-44 chars)
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!SOLANA_ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: "invalid-address", message: "Not a valid Solana address" },
      { status: 400 }
    );
  }

  if (!process.env.HELIUS_API_KEY) {
    return NextResponse.json(
      { error: "no-api-key", message: "HELIUS_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Check if this is a known KOL
    const kol = KOL_WALLETS.find((k) => k.address === address);
    const metrics = await fetchWalletMetrics(address, kol?.name);

    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[wallet/${address}] Error:`, message);

    if (message.includes("429") || message.includes("rate")) {
      return NextResponse.json(
        { error: "rate-limit", message: "Too many requests, try again shortly" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "fetch-failed", message },
      { status: 500 }
    );
  }
}
