"use client";

import { useState, useMemo } from "react";
import type { WalletMetrics } from "@/lib/solana";

type SortKey = "pnl" | "degen" | "volume" | "trades" | "winRate" | "tokens";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "pnl", label: "PNL (ALL-TIME)" },
  { key: "degen", label: "DEGEN" },
  { key: "volume", label: "VOLUME" },
  { key: "trades", label: "TRADES" },
  { key: "winRate", label: "WIN %" },
  { key: "tokens", label: "TOKENS" },
];

function shortenAddr(addr: string) {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

function getSortValue(w: WalletMetrics, key: SortKey): number {
  switch (key) {
    case "pnl": return w.pnlUsd;
    case "degen": return w.degenScore;
    case "volume": return w.volumeEstimate;
    case "trades": return w.totalTrades;
    case "winRate": return w.winRate;
    case "tokens": return w.uniqueTokensTraded;
  }
}

function fmtSortValue(w: WalletMetrics, key: SortKey): string {
  switch (key) {
    case "pnl": return (w.pnlUsd >= 0 ? "+$" : "-$") + fmtNum(Math.abs(w.pnlUsd)) + (w.pnlIsReal ? "" : " EST");
    case "degen": return w.degenScore.toFixed(0) + "/100";
    case "volume": return fmtNum(w.volumeEstimate) + " SOL";
    case "trades": return fmtNum(w.totalTrades);
    case "winRate": return (w.winRate * 100).toFixed(1) + "%";
    case "tokens": return w.uniqueTokensTraded.toString();
  }
}

interface DatabasePanelProps {
  wallets: WalletMetrics[];
  nicknames: Record<string, string>;
  onNavigate: (wallet: WalletMetrics) => void;
  onClose: () => void;
}

export default function DatabasePanel({ wallets, nicknames, onNavigate, onClose }: DatabasePanelProps) {
  const [sortBy, setSortBy] = useState<SortKey>("pnl");
  const [searchFilter, setSearchFilter] = useState("");

  // Get user-submitted wallets from localStorage
  const userWallets = useMemo(() => {
    try {
      const deployed = JSON.parse(localStorage.getItem("solcity-deployed") || "[]");
      if (!Array.isArray(deployed)) return [];
      const deployedAddrs = new Set(deployed.map((w: WalletMetrics) => w.address));
      return wallets.filter(w => deployedAddrs.has(w.address));
    } catch {
      return [];
    }
  }, [wallets]);

  // Sorted + filtered leaderboard
  const sorted = useMemo(() => {
    let list = [...wallets];
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      list = list.filter(w =>
        w.address.toLowerCase().includes(q) ||
        (w.name && w.name.toLowerCase().includes(q)) ||
        (nicknames[w.address] && nicknames[w.address].toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => getSortValue(b, sortBy) - getSortValue(a, sortBy));
    return list;
  }, [wallets, sortBy, searchFilter, nicknames]);

  const displayName = (w: WalletMetrics) =>
    nicknames[w.address] || w.name || shortenAddr(w.address);

  const getRankColor = (i: number) => {
    if (i === 0) return "#ffe45c";
    if (i === 1) return "#c0c0c0";
    if (i === 2) return "#cd7f32";
    return "#8c8c9c";
  };

  const getRankBadge = (i: number) => {
    if (i === 0) return "👑";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-sm overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #0d0a14 0%, #0a0a0f 100%)",
          border: "1px solid #b44dff40",
          boxShadow: "0 0 40px #b44dff20, 0 0 80px #ff69c710",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#b44dff]/20">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">📊</span>
            <h2 className="font-pixel text-sm text-cream tracking-[0.15em]">
              <span style={{ color: "#ff69c7", textShadow: "0 0 8px #ff69c740" }}>SOL</span>
              <span style={{ color: "#ffe45c", textShadow: "0 0 8px #ffe45c40" }}>CITY</span>
              <span className="text-dim ml-2">DATABASE</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-press font-pixel text-[10px] text-dim hover:text-cream transition-colors px-2 py-1"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Search filter */}
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            placeholder="FILTER WALLETS..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[#1a1520] border border-[#b44dff]/20 rounded-sm px-3 py-1.5 text-[9px] font-pixel text-cream placeholder:text-dim/50 outline-none focus:border-[#b44dff]/50 transition-colors"
            spellCheck={false}
          />
        </div>

        {/* Sort tabs */}
        <div className="px-4 pb-2 flex gap-1 flex-wrap">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className="btn-press font-pixel text-[8px] px-2 py-1 rounded-sm transition-all"
              style={{
                background: sortBy === opt.key ? "#b44dff" : "#1a1520",
                color: sortBy === opt.key ? "#0a0a0f" : "#8c8c9c",
                border: `1px solid ${sortBy === opt.key ? "#b44dff" : "#b44dff20"}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-[#b44dff30] scrollbar-track-transparent">

          {/* ── YOUR SUBMISSIONS ── */}
          {userWallets.length > 0 && !searchFilter.trim() && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-[#ff69c7]/20" />
                <span className="font-pixel text-[8px] text-[#ff69c7] tracking-[0.2em]">YOUR SUBMISSIONS</span>
                <div className="h-px flex-1 bg-[#ff69c7]/20" />
              </div>
              {userWallets.map((w) => {
                const rank = sorted.findIndex(s => s.address === w.address);
                return (
                  <div
                    key={`user-${w.address}`}
                    className="flex items-center gap-2 py-2 px-2 mb-1 rounded-sm transition-colors hover:bg-[#ff69c7]/5"
                    style={{ border: "1px solid #ff69c720" }}
                  >
                    <span className="font-pixel text-[8px] text-[#ff69c7] w-7 text-center flex-shrink-0">
                      {rank >= 0 ? `#${rank + 1}` : "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-pixel text-[9px] text-cream truncate">{displayName(w)}</p>
                      <p className="font-pixel text-[7px] text-dim truncate">{shortenAddr(w.address)}</p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-1">
                      <p className="font-pixel text-[8px]" style={{ color: w.pnlUsd >= 0 ? "#4ade80" : "#ff2d55" }}>
                        {fmtSortValue(w, sortBy)}
                      </p>
                      <p className="font-pixel text-[7px] text-dim">
                        DEGEN {w.degenScore.toFixed(0)}
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigate(w)}
                      className="btn-press font-pixel text-[7px] px-2 py-1 rounded-sm flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #ff69c7, #b44dff)",
                        color: "#0a0a0f",
                      }}
                    >
                      GO TO
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── LEADERBOARD ── */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-[#b44dff]/20" />
            <span className="font-pixel text-[8px] text-[#b44dff] tracking-[0.2em]">
              LEADERBOARD — {SORT_OPTIONS.find(o => o.key === sortBy)?.label}
            </span>
            <div className="h-px flex-1 bg-[#b44dff]/20" />
          </div>

          {sorted.length === 0 ? (
            <p className="font-pixel text-[9px] text-dim text-center py-6">NO WALLETS FOUND</p>
          ) : (
            sorted.map((w, i) => (
              <div
                key={w.address}
                className="flex items-center gap-2 py-2 px-2 mb-0.5 rounded-sm transition-colors hover:bg-[#b44dff]/5"
                style={{
                  borderLeft: i < 3 ? `2px solid ${getRankColor(i)}` : "2px solid transparent",
                }}
              >
                {/* Rank */}
                <span
                  className="font-pixel text-[9px] w-7 text-center flex-shrink-0"
                  style={{ color: getRankColor(i) }}
                >
                  {getRankBadge(i)}
                </span>

                {/* Name + address */}
                <div className="flex-1 min-w-0">
                  <p className="font-pixel text-[9px] text-cream truncate">{displayName(w)}</p>
                  <p className="font-pixel text-[7px] text-dim truncate">{shortenAddr(w.address)}</p>
                </div>

                {/* Stats */}
                <div className="text-right flex-shrink-0 mr-1">
                  <p
                    className="font-pixel text-[8px]"
                    style={{
                      color: sortBy === "pnl"
                        ? (w.pnlUsd >= 0 ? "#4ade80" : "#ff2d55")
                        : "#ffe45c",
                    }}
                  >
                    {fmtSortValue(w, sortBy)}
                  </p>
                  {sortBy !== "degen" && (
                    <p className="font-pixel text-[7px] text-dim">
                      DEGEN {w.degenScore.toFixed(0)}
                    </p>
                  )}
                  {sortBy === "degen" && (
                    <p className="font-pixel text-[7px] text-dim">
                      PNL {(w.pnlUsd >= 0 ? "+$" : "-$") + fmtNum(Math.abs(w.pnlUsd))}
                    </p>
                  )}
                </div>

                {/* Navigate button */}
                <button
                  onClick={() => onNavigate(w)}
                  className="btn-press font-pixel text-[7px] px-2 py-1 rounded-sm flex-shrink-0 transition-colors"
                  style={{
                    background: "#1a1520",
                    color: "#b44dff",
                    border: "1px solid #b44dff40",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#b44dff";
                    e.currentTarget.style.color = "#0a0a0f";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#1a1520";
                    e.currentTarget.style.color = "#b44dff";
                  }}
                >
                  GO TO
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#b44dff]/10 flex items-center justify-between">
          <span className="font-pixel text-[7px] text-dim">
            {sorted.length} WALLETS
          </span>
          <span className="font-pixel text-[7px] text-dim">
            SOLCITY.CITY
          </span>
        </div>
      </div>
    </div>
  );
}
