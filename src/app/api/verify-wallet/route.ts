import { NextRequest, NextResponse } from "next/server";

const DONATION_WALLET = "5t997b4cWJLE8ESeCUNw9E37vjZC5B7rUcyx9TtxNQGu";
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=";

/**
 * POST /api/verify-wallet
 * Body: { senderWallet: string, expectedAmount: string }
 *
 * Checks recent transactions to the donation wallet for a matching
 * amount from the specified sender. Amount-based verification
 * (no memo needed — works with Phantom and all wallets).
 */
export async function POST(req: NextRequest) {
  try {
    const { senderWallet, expectedAmount } = await req.json();

    if (!senderWallet || !expectedAmount) {
      return NextResponse.json(
        { verified: false, error: "Missing senderWallet or expectedAmount" },
        { status: 400 }
      );
    }

    const expectedLamports = Math.round(parseFloat(expectedAmount) * 1e9);

    // Use Solana RPC to get recent transactions for the donation wallet
    const rpcUrl = process.env.HELIUS_API_KEY
      ? `${HELIUS_RPC}${process.env.HELIUS_API_KEY}`
      : "https://api.mainnet-beta.solana.com";

    // Get recent signatures for the donation wallet
    const sigRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [DONATION_WALLET, { limit: 20 }],
      }),
    });

    const sigData = await sigRes.json();
    const signatures = sigData?.result || [];

    if (signatures.length === 0) {
      return NextResponse.json({
        verified: false,
        message: "No recent transactions found. Please send the exact amount and try again.",
      });
    }

    // Check each recent transaction for a matching transfer
    for (const sig of signatures) {
      const txRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
        }),
      });

      const txData = await txRes.json();
      const tx = txData?.result;
      if (!tx) continue;

      // Look for a SOL transfer from senderWallet to donation wallet
      const instructions = tx.transaction?.message?.instructions || [];
      for (const ix of instructions) {
        if (
          ix.program === "system" &&
          ix.parsed?.type === "transfer" &&
          ix.parsed?.info?.source?.toLowerCase() === senderWallet.toLowerCase() &&
          ix.parsed?.info?.destination?.toLowerCase() === DONATION_WALLET.toLowerCase()
        ) {
          const lamports = ix.parsed.info.lamports;
          // Allow small tolerance (±1000 lamports / 0.000001 SOL)
          if (Math.abs(lamports - expectedLamports) < 1000) {
            return NextResponse.json({
              verified: true,
              signature: sig.signature,
              message: "Wallet verified successfully!",
            });
          }
        }
      }
    }

    return NextResponse.json({
      verified: false,
      message: "Transaction not found yet. Make sure you sent the exact amount and try again in a few seconds.",
    });
  } catch (error) {
    console.error("Verify wallet error:", error);
    return NextResponse.json(
      { verified: false, error: "Verification service error" },
      { status: 500 }
    );
  }
}
