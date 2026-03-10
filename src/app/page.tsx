"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { generateCityLayout, type DeveloperRecord, type CityBuilding } from "@/lib/github";
import { DEFAULT_SKY_ADS } from "@/lib/skyAds";
import DatabasePanel from "@/components/DatabasePanel";

/* ─── Wallet Metrics Types ─────────────────────────────────── */
interface WalletMetrics {
  address: string;
  name?: string;
  solBalance: number;
  totalTransactions: number;
  tokenCount: number;
  nftCount: number;
  volumeEstimate: number;
  swapCount: number;
  uniqueTokensTraded: number;
  pnlUsd: number;
  realizedPnlUsd: number;
  winRate: number;
  totalTrades: number;
  avgHoldTime: string;
  rugsSurvived: number;
  degenScore: number;
  pnlIsReal: boolean;
  citySize: number;
  skyscraperHeight: number;
  buildingCount: number;
  districtCount: number;
  hasNeonDistrict: boolean;
  parkCount: number;
}

const SOCIAL_LINKS = {
  x: "https://x.com/SolC1ty",
  chart: "https://dexscreener.com/",
  buy: "https://pump.fun/",
};

const DONATION_WALLET = "5t997b4cWJLE8ESeCUNw9E37vjZC5B7rUcyx9TtxNQGu";

function shortenAddr(addr: string) {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

const CityCanvas = dynamic(() => import("@/components/CityCanvas"), {
  ssr: false,
});

/* ─── Metric → City Mapping ────────────────────────────────── */
const CITY_MAPPINGS = [
  { metric: "Total Volume", city: "City Size", icon: "VOL", color: "#ff2d95" },
  { metric: "PnL", city: "Skyscraper Height", icon: "PNL", color: "#b44dff" },
  { metric: "Trades", city: "Building Count", icon: "TRD", color: "#ffe45c" },
  { metric: "Token Diversity", city: "District Count", icon: "TOK", color: "#14f195" },
  { metric: "Meme Coin Trading", city: "Neon District", icon: "MEM", color: "#9945ff" },
  { metric: "Long Holds", city: "Parks & Gardens", icon: "HLD", color: "#14f195" },
];

/* ─── Verification Steps ───────────────────────────────────── */
const VERIFY_STEPS = [
  { step: 1, title: "Enter Wallet", desc: "Paste your Solana wallet address" },
  { step: 2, title: "Send Exact Amount", desc: "Send the exact SOL amount shown below" },
  { step: 3, title: "Auto-Verify", desc: "Blockchain confirms ownership" },
  { step: 4, title: "City Deploys", desc: "Your on-chain city is generated" },
];

/* Stable timestamp for deterministic city generation (avoids useMemo rebuild) */
const STABLE_ISO = "2025-01-01T00:00:00.000Z";


/* ─── Scanline overlay for VHS effect ──────────────────────── */
function VHSScanlines() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.03) 2px)",
        backgroundSize: "100% 2px",
      }}
    />
  );
}

/* ─── Neon text component ──────────────────────────────────── */
function NeonText({
  children,
  color = "#ff2d95",
  className = "",
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        color,
        textShadow: `0 0 7px ${color}, 0 0 10px ${color}, 0 0 21px ${color}, 0 0 42px ${color}40`,
      }}
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT — Fullscreen 3D City + HUD Overlays
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [verifyStep, setVerifyStep] = useState(0);
  const [walletData, setWalletData] = useState<WalletMetrics | null>(null);
  const [seedCity, setSeedCity] = useState<WalletMetrics[]>([]);
  const [isFlyMode, setIsFlyMode] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [verifyAmount, setVerifyAmount] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showVerifyPanel, setShowVerifyPanel] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<WalletMetrics | null>(null);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [showHud, setShowHud] = useState(true);
  const [showAdsPanel, setShowAdsPanel] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [copied, setCopied] = useState("");
  const [deployComplete, setDeployComplete] = useState(false);
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);
  const [focusedBuildingLogin, setFocusedBuildingLogin] = useState<string | null>(null);
  const [verifyPolling, setVerifyPolling] = useState(false);
  const [exploreSearch, setExploreSearch] = useState("");
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [adCart, setAdCart] = useState<{ id: string; name: string; price: number; days: number }[]>([]);
  const [verifyMessage, setVerifyMessage] = useState("");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walletDataRef = useRef<WalletMetrics | null>(null);
  useEffect(() => { walletDataRef.current = walletData; }, [walletData]);

  // ── Persist verification state across page reloads ──
  const persistVerify = useCallback(() => {
    try {
      sessionStorage.setItem("solcity-verify", JSON.stringify({
        walletAddress, verifyStep, verifyAmount, walletData, showVerifyPanel, deployComplete,
      }));
    } catch {}
  }, [walletAddress, verifyStep, verifyAmount, walletData, showVerifyPanel, deployComplete]);

  // Save to sessionStorage whenever verification state changes
  useEffect(() => {
    if (verifyStep > 0) persistVerify();
  }, [verifyStep, verifyAmount, walletData, deployComplete, persistVerify]);

  // Restore verification state on mount
  const verifyRestoredRef = useRef(false);
  useEffect(() => {
    if (verifyRestoredRef.current) return;
    verifyRestoredRef.current = true;
    try {
      const saved = sessionStorage.getItem("solcity-verify");
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.verifyStep > 0 && s.walletAddress) {
        setWalletAddress(s.walletAddress);
        setVerifyAmount(s.verifyAmount || "");
        setWalletData(s.walletData || null);
        setShowVerifyPanel(true);
        setShowHud(false);
        if (s.deployComplete) {
          setVerifyStep(4);
          setDeployComplete(true);
        } else if (s.verifyStep >= 1 && s.verifyStep <= 2) {
          // Restore to step 1 so user can re-confirm
          setVerifyStep(1);
          setDeployComplete(false);
        }
      }
    } catch {}
  }, []);

  const cityLayoutCacheRef = useRef<{ key: string; layout: ReturnType<typeof generateCityLayout> } | null>(null);
  const cityPreview = useMemo(() => {
    if (seedCity.length === 0) return null;
    // Cache key: wallet count + first/last address to detect real data changes
    const cacheKey = `${seedCity.length}:${seedCity[0]?.address}:${seedCity[seedCity.length - 1]?.address}`;
    if (cityLayoutCacheRef.current?.key === cacheKey) return cityLayoutCacheRef.current.layout;

    const DISTRICTS = ["frontend", "backend", "fullstack", "data_ai", "devops", "mobile", "gamedev", "vibe_coder", "creator", "security"];
    const LANGS: Record<string, string> = { frontend: "JavaScript", backend: "Rust", fullstack: "TypeScript", data_ai: "Python", devops: "Shell", mobile: "Kotlin", gamedev: "GDScript", vibe_coder: "JavaScript", creator: "TypeScript", security: "Rust" };

    // Real KOL wallets — NO boost, 100% raw metrics from Helius/kolscan
    const kolDevs: DeveloperRecord[] = seedCity.map((wallet, idx) => {
      return {
        id: idx + 1,
        github_login: wallet.address,
        github_id: null,
        name: wallet.name ?? null,
        avatar_url: null,
        bio: null,
        contributions: wallet.totalTransactions,
        public_repos: Math.max(5, wallet.tokenCount * 3),
        total_stars: Math.max(10, Math.floor(wallet.volumeEstimate)),
        primary_language: wallet.hasNeonDistrict ? "JavaScript" : "TypeScript",
        rank: idx + 1,
        fetched_at: STABLE_ISO,
        created_at: STABLE_ISO,
        claimed: true,
        fetch_priority: 0,
        claimed_at: null,
        district: wallet.hasNeonDistrict ? "vibe_coder" : DISTRICTS[idx % DISTRICTS.length],
        owned_items: [],
        custom_color: null,
        billboard_images: [],
        contributions_total: wallet.totalTransactions,
        language_diversity: Math.max(3, wallet.districtCount * 2),
        total_prs: Math.floor(wallet.swapCount * 1.5),
        total_reviews: Math.floor(wallet.swapCount * 0.3),
        total_issues: Math.floor(wallet.swapCount * 0.2),
        repos_contributed_to: Math.max(5, wallet.uniqueTokensTraded * 2),
        followers: Math.max(50, wallet.degenScore * 40),
        following: Math.max(20, wallet.districtCount * 20),
        organizations_count: Math.max(2, wallet.districtCount),
        account_created_at: STABLE_ISO,
        current_streak: Math.max(5, wallet.parkCount * 5),
        longest_streak: Math.max(10, wallet.parkCount * 8),
        active_days_last_year: Math.max(100, wallet.totalTransactions % 365),
        xp_total: wallet.degenScore * 200,
        xp_level: Math.max(3, Math.floor(wallet.degenScore / 5)),
        xp_github: wallet.degenScore * 80,
      };
    });

    // Generate synthetic filler buildings to make city look evolved & dense
    const FILLER_COUNT = 350;
    const fillerDevs: DeveloperRecord[] = Array.from({ length: FILLER_COUNT }, (_, i) => {
      const seed = (i * 7919 + 31337) | 0;
      const s = (v: number) => Math.abs(((v * 16807) % 2147483647) - 1) / 2147483646;
      const did = DISTRICTS[i % DISTRICTS.length];
      const contribs = Math.floor(200 + s(seed) * 2000);
      const stars = Math.floor(20 + s(seed + 1) * 500);
      const repos = Math.floor(5 + s(seed + 2) * 60);
      return {
        id: 1000 + i,
        github_login: `filler_${i.toString(16).padStart(4, "0")}`,
        github_id: null,
        name: null,
        avatar_url: null,
        bio: null,
        contributions: contribs,
        public_repos: repos,
        total_stars: stars,
        primary_language: LANGS[did] ?? "TypeScript",
        rank: 100 + i,
        fetched_at: STABLE_ISO,
        created_at: STABLE_ISO,
        claimed: false,
        fetch_priority: 0,
        claimed_at: null,
        district: did,
        owned_items: [],
        custom_color: null,
        billboard_images: [],
        contributions_total: contribs,
        language_diversity: Math.floor(1 + s(seed + 3) * 5),
        total_prs: Math.floor(contribs * 0.3),
        total_reviews: Math.floor(contribs * 0.1),
        total_issues: Math.floor(contribs * 0.05),
        repos_contributed_to: Math.floor(2 + s(seed + 4) * 15),
        followers: Math.floor(5 + s(seed + 5) * 100),
        following: Math.floor(5 + s(seed + 6) * 50),
        organizations_count: Math.floor(1 + s(seed + 7) * 3),
        account_created_at: STABLE_ISO,
        current_streak: Math.floor(1 + s(seed + 8) * 20),
        longest_streak: Math.floor(5 + s(seed + 9) * 30),
        active_days_last_year: Math.floor(30 + s(seed + 10) * 200),
        xp_total: Math.floor(s(seed + 11) * 500),
        xp_level: Math.floor(1 + s(seed + 12) * 8),
        xp_github: Math.floor(s(seed + 13) * 300),
      };
    });

    const layout = generateCityLayout([...kolDevs, ...fillerDevs]);
    cityLayoutCacheRef.current = { key: cacheKey, layout };
    return layout;
  }, [seedCity]);

  // Load seed city on mount — only fetch once, skip if already loaded
  const seedFetchedRef = useRef(false);
  useEffect(() => {
    if (seedFetchedRef.current) return;
    seedFetchedRef.current = true;
    fetch("/api/city/seed")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Merge any previously deployed wallets from localStorage
          try {
            const deployed = JSON.parse(localStorage.getItem("solcity-deployed") || "[]");
            if (Array.isArray(deployed) && deployed.length > 0) {
              const addresses = new Set(data.map((w: WalletMetrics) => w.address));
              const extras = deployed.filter((w: WalletMetrics) => !addresses.has(w.address));
              setSeedCity([...data, ...extras]);
              return;
            }
          } catch {}
          setSeedCity(data);
        }
      })
      .catch(() => {});
  }, []);

  // Splash screen: minimum 3 seconds before fading out
  // Reset on every mount (including HMR Fast Refresh)
  useEffect(() => {
    setSplashDone(false);
    const timer = setTimeout(() => setSplashDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Load nicknames from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("solcity-nicknames");
      if (saved) setNicknames(JSON.parse(saved));
    } catch {}
  }, []);

  const saveNickname = useCallback(
    (address: string, name: string) => {
      const updated = { ...nicknames, [address]: name.trim() || undefined } as Record<string, string>;
      if (!name.trim()) delete updated[address];
      setNicknames(updated);
      localStorage.setItem("solcity-nicknames", JSON.stringify(updated));
      setEditingNickname(false);
    },
    [nicknames]
  );

  const displayName = useCallback(
    (w: WalletMetrics) => nicknames[w.address] || w.name || shortenAddr(w.address),
    [nicknames]
  );

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    });
  }, []);

  // Fetch wallet metrics
  const fetchWallet = useCallback(async (address: string) => {
    setFetchError("");
    try {
      const res = await fetch(`/api/wallet/${address}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const data: WalletMetrics = await res.json();
      setWalletData(data);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to fetch wallet");
    }
  }, []);

  // Start verification — amount-based (Phantom can't send memos)
  const startVerification = useCallback(() => {
    if (!walletAddress.trim()) return;
    // Generate unique amount: 0.001 + random 3-digit suffix → e.g. 0.001742
    const suffix = Math.floor(100 + Math.random() * 900);
    setVerifyAmount(`0.001${suffix}`);
    setVerifyStep(1);
    setShowVerifyPanel(true);
    setShowHud(false);
    setDeployComplete(false);
    setShowNicknamePrompt(false);
    fetchWallet(walletAddress.trim());
  }, [walletAddress, fetchWallet]);

  // User confirms they sent the transaction — start polling RPC
  const confirmSent = useCallback(() => {
    setVerifyStep(2);
    setVerifyPolling(true);
    setVerifyMessage("Watching blockchain for your transaction...");

    // Clear any existing poll
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const poll = async () => {
      try {
        const res = await fetch("/api/verify-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderWallet: walletAddress, expectedAmount: verifyAmount }),
        });
        const data = await res.json();

        if (data.verified) {
          // Success!
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setVerifyPolling(false);
          setVerifyStep(3);
          setVerifyMessage("Transaction found! Deploying your city...");
          // Add the deployed wallet to seedCity so it gets a building
          const wd = walletDataRef.current;
          if (wd) {
            setSeedCity(prev => {
              if (prev.find(w => w.address === wd.address)) return prev;
              return [...prev, wd];
            });
            // Persist to localStorage so it survives page reloads
            try {
              const saved = JSON.parse(localStorage.getItem("solcity-deployed") || "[]");
              if (!saved.find((w: WalletMetrics) => w.address === wd.address)) {
                saved.push(wd);
                localStorage.setItem("solcity-deployed", JSON.stringify(saved));
              }
            } catch {}
          }
          setTimeout(() => {
            setVerifyStep(4);
            setDeployComplete(true);
            setShowNicknamePrompt(true);
            setVerifyMessage("");
          }, 2000);
        } else {
          setVerifyMessage(data.message || "Still looking for your transaction...");
        }
      } catch {
        setVerifyMessage("Network error — retrying...");
      }
    };

    // First poll immediately, then every 5 seconds
    poll();
    pollIntervalRef.current = setInterval(poll, 5000);
  }, [walletAddress, verifyAmount]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Reset deploy state for new wallet
  const resetDeploy = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    setVerifyStep(0);
    setVerifyPolling(false);
    setVerifyMessage("");
    setShowVerifyPanel(false);
    setShowHud(true);
    setDeployComplete(false);
    setShowNicknamePrompt(false);
    setWalletData(null);
    setWalletAddress("");
    setVerifyAmount("");
    try { sessionStorage.removeItem("solcity-verify"); } catch {}
    setFocusedBuildingLogin(null);
  }, []);

  // Generate tweet text
  const tweetText = useMemo(() => {
    const addr = shortenAddr(walletAddress);
    return encodeURIComponent(`I just deployed my wallet ${addr} on the Solana skyline! 🏙️\n\nCheck out @SolC1ty — Visualizing the Solana Skyline\n\nhttps://solcity.city`);
  }, [walletAddress]);

  const hudVisible = showHud && !selectedBuilding && !showVerifyPanel && !isFlyMode;

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0a0a0f]">
      <VHSScanlines />

      {/* ═══ 3D CITY — ALWAYS VISIBLE AS BACKGROUND ═══ */}
      {cityPreview ? (
        <div className="absolute inset-0 z-0">
          <CityCanvas
            buildings={cityPreview.buildings}
            plazas={cityPreview.plazas}
            decorations={cityPreview.decorations}
            river={cityPreview.river}
            bridges={cityPreview.bridges}
            flyMode={isFlyMode}
            onExitFly={() => setIsFlyMode(false)}
            themeIndex={1}
            focusedBuilding={focusedBuildingLogin}
            skyAds={DEFAULT_SKY_ADS}
            onCollect={() => {}}
            onHud={() => {}}
            onPause={() => {}}
            onClearFocus={() => {
              // Skip if a building was just clicked (InstancedBuildings uses raw DOM events, fires alongside onPointerMissed)
              if ((window as unknown as Record<string, boolean>).__buildingClicked) return;
              if (selectedBuilding) { setSelectedBuilding(null); setShowHud(true); setEditingNickname(false); setFocusedBuildingLogin(null); }
              if (showHowItWorks) setShowHowItWorks(false);
              if (showAdsPanel) setShowAdsPanel(false);
            }}
            onBuildingClick={(building: CityBuilding) => {
              const wallet = seedCity.find((w) => w.address === building.login);
              if (wallet) {
                setSelectedBuilding(wallet);
                setFocusedBuildingLogin(wallet.address);
                setShowHud(false);
                setShowHowItWorks(false);
                setShowVerifyPanel(false);
                setShowAdsPanel(false);
              }
            }}
          />
        </div>
      ) : null}

      {/* ═══ SPLASH / LOADING SCREEN ═══ */}
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0f] transition-opacity duration-700"
        style={{
          opacity: (cityPreview && splashDone) ? 0 : 1,
          pointerEvents: (cityPreview && splashDone) ? "none" : "auto",
        }}
      >
        {/* Circular GIF — same style as hero section */}
        <div
          className="mb-5 rounded-full overflow-hidden border-2 flex-shrink-0"
          style={{
            width: 110,
            height: 110,
            borderColor: "#ff2d95",
            boxShadow: "0 0 24px #ff2d9550, 0 0 48px #ff2d9520",
          }}
        >
          <img
            src="/solcity-hero.gif"
            alt="SolCity"
            width={110}
            height={110}
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="font-pixel text-2xl sm:text-3xl tracking-[0.15em] mb-4">
          <span style={{ color: "#ff69c7", textShadow: "0 0 20px #ff69c760, 0 0 40px #ff69c730" }}>SOL</span>
          <span style={{ color: "#ffe45c", textShadow: "0 0 20px #ffe45c60, 0 0 40px #ffe45c30" }}>CITY</span>
        </h1>
        <div className="w-40 sm:w-56 h-1 bg-[#1a1520] rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #ff69c7, #ffe45c)",
              animation: "loadbar 2s ease-in-out infinite",
            }}
          />
        </div>
        <p className="font-pixel text-[9px] text-dim tracking-widest">
          {cityPreview ? "ENTERING SKYLINE..." : "LOADING CITY..."}
        </p>
        <style>{`@keyframes loadbar { 0% { width: 0%; } 50% { width: 80%; } 100% { width: 100%; } }`}</style>
      </div>

      {/* ═══ TOP NAV BAR ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-2.5 bg-bg/50 backdrop-blur-md border-b border-border/30 transition-all duration-300 ${isFlyMode ? "opacity-0 pointer-events-none -translate-y-full" : "opacity-100"}`}>
        <button
          onClick={() => { setShowHud(true); setSelectedBuilding(null); setFocusedBuildingLogin(null); setShowVerifyPanel(false); setShowHowItWorks(false); }}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <span className="font-pixel text-base sm:text-lg" style={{ color: "#ff69c7", textShadow: "0 0 12px #ff69c760" }}>SOL</span>
          <span className="font-pixel text-base sm:text-lg" style={{ color: "#ffe45c", textShadow: "0 0 12px #ffe45c60" }}>CITY</span>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a href={SOCIAL_LINKS.x} target="_blank" rel="noopener noreferrer"
            className="btn-press border border-[#ff2d95]/30 px-2 sm:px-3 py-1 text-[8px] sm:text-[9px] text-[#ff2d95] hover:bg-[#ff2d95]/10 transition-colors font-pixel">
            𝕏
          </a>
          <a href={SOCIAL_LINKS.chart} target="_blank" rel="noopener noreferrer"
            className="btn-press border border-[#00f0ff]/30 px-2 sm:px-3 py-1 text-[8px] sm:text-[9px] text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-colors font-pixel">
            CHART
          </a>
          <a href={SOCIAL_LINKS.buy} target="_blank" rel="noopener noreferrer"
            className="btn-press px-2 sm:px-3 py-1 text-[8px] sm:text-[9px] text-black font-pixel font-bold"
            style={{ background: "linear-gradient(135deg, #ffe45c, #ff8a3d)" }}>
            BUY
          </a>
        </div>
      </nav>

      {/* ═══ EXPLORE MODE SEARCH BAR ═══ */}
      {!hudVisible && !isFlyMode && !showVerifyPanel && !selectedBuilding && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4">
          <div className="flex items-stretch border border-[#b44dff]/40 bg-bg/80 backdrop-blur-md rounded-sm overflow-hidden">
            <input
              type="text"
              placeholder="SEARCH WALLET..."
              value={exploreSearch}
              onChange={(e) => setExploreSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && exploreSearch.trim()) {
                  const q = exploreSearch.trim().toLowerCase();
                  const match = seedCity.find(w =>
                    w.address.toLowerCase().includes(q) ||
                    (w.name && w.name.toLowerCase().includes(q)) ||
                    (nicknames[w.address] && nicknames[w.address].toLowerCase().includes(q))
                  );
                  if (match) {
                    setFocusedBuildingLogin(match.address);
                    setSelectedBuilding(match);
                    setExploreSearch("");
                    setSearchNotFound(false);
                  } else {
                    setSearchNotFound(true);
                    setTimeout(() => setSearchNotFound(false), 2000);
                  }
                }
              }}
              className="flex-1 bg-transparent px-3 py-2 text-[10px] font-pixel text-cream placeholder:text-dim/60 outline-none min-w-0"
              spellCheck={false}
            />
            <button
              onClick={() => {
                if (!exploreSearch.trim()) return;
                const q = exploreSearch.trim().toLowerCase();
                const match = seedCity.find(w =>
                  w.address.toLowerCase().includes(q) ||
                  (w.name && w.name.toLowerCase().includes(q)) ||
                  (nicknames[w.address] && nicknames[w.address].toLowerCase().includes(q))
                );
                if (match) {
                  setFocusedBuildingLogin(match.address);
                  setSelectedBuilding(match);
                  setExploreSearch("");
                  setSearchNotFound(false);
                } else {
                  setSearchNotFound(true);
                  setTimeout(() => setSearchNotFound(false), 2000);
                }
              }}
              className="btn-press px-3 py-2 text-[9px] font-pixel text-[#b44dff] hover:bg-[#b44dff]/10 flex-shrink-0"
            >
              🔍
            </button>
          </div>
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => setShowDatabase(true)}
              className="btn-press flex-1 px-3 py-1.5 text-[8px] font-pixel font-bold flex-shrink-0 rounded-sm transition-colors"
              style={{
                background: "#1a1520",
                color: "#b44dff",
                border: "1px solid #b44dff40",
              }}
            >
              📊 DATABASE
            </button>
            <button
              onClick={() => { setIsFlyMode(true); setShowHud(false); setSelectedBuilding(null); }}
              className="btn-press flex-1 px-3 py-1.5 text-[8px] font-pixel font-bold text-black flex-shrink-0 rounded-sm"
              style={{ background: "linear-gradient(135deg, #ff69c7, #ffe45c)" }}
            >
              ✈ FLY
            </button>
          </div>
          {searchNotFound && (
            <p className="text-[9px] font-pixel text-[#ff2d95] text-center mt-1 animate-pulse">WALLET NOT FOUND IN CITY</p>
          )}
        </div>
      )}

      {/* ═══ CENTER HUD — Title + Wallet Input ═══ */}
      <div
        className={`fixed inset-0 z-30 flex items-center justify-center pointer-events-none transition-all duration-500 ${
          hudVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{ paddingBottom: "6vh" }}
      >
        <div className={`${hudVisible ? "pointer-events-auto" : "pointer-events-none"} flex flex-col items-center text-center max-w-lg px-4`}>
          {/* Circular GIF above title */}
          <div
            className="mb-4 rounded-full overflow-hidden border-2 flex-shrink-0"
            style={{
              width: 90,
              height: 90,
              borderColor: "#ff2d95",
              boxShadow: "0 0 20px #ff2d9540, 0 0 40px #ff2d9520",
            }}
          >
            <img
              src="/solcity-hero.gif"
              alt="SolCity"
              width={90}
              height={90}
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="font-pixel text-4xl sm:text-6xl md:text-7xl tracking-[0.15em] mb-1 leading-tight">
            <NeonText color="#ff69c7">SOL</NeonText>
            <NeonText color="#ffe45c">CITY</NeonText>
          </h1>
          <p className="font-pixel text-[11px] sm:text-[13px] font-bold text-cream/90 tracking-[0.25em] uppercase mb-5" style={{ textShadow: '0 0 10px #ff69c740, 0 0 20px #ff69c720' }}>
            Visualizing the Solana Skyline
          </p>

          {/* Wallet Input */}
          <div className="w-full max-w-md mb-4">
            <div
              className="flex items-stretch border-2 bg-bg/70 backdrop-blur-md transition-colors rounded-sm"
              style={{ borderColor: walletAddress ? "#b44dff" : "#2a204080" }}
            >
              <input
                type="text"
                placeholder="ENTER WALLET ADDRESS..."
                value={walletAddress}
                onChange={(e) => { setWalletAddress(e.target.value); if (verifyStep > 0) { setVerifyStep(0); setDeployComplete(false); } }}
                onKeyDown={(e) => e.key === "Enter" && startVerification()}
                className="flex-1 bg-transparent px-3 py-3 text-[11px] sm:text-[12px] font-pixel text-cream placeholder:text-dim/60 outline-none min-w-0"
                spellCheck={false}
              />
              <button
                onClick={startVerification}
                disabled={!walletAddress.trim()}
                className="btn-press px-5 py-3 text-[10px] sm:text-[11px] font-pixel font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                style={{
                  background: walletAddress.trim() ? "linear-gradient(135deg, #ff2d95, #b44dff)" : "#2a2040",
                  color: walletAddress.trim() ? "#000" : "#6c5c8c",
                }}
              >
                DEPLOY
              </button>
            </div>
          </div>

          {/* CTA Row 1: How it works | Explore City */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <button
              onClick={() => { setShowHowItWorks(true); setSelectedBuilding(null); setShowVerifyPanel(false); setShowAdsPanel(false); }}
              className="btn-press px-5 py-2.5 text-[10px] sm:text-[11px] font-pixel font-bold text-[#b44dff] hover:brightness-110 transition-all relative"
              style={{ border: "2px solid #b44dff80", background: "rgba(10,10,15,0.6)", backdropFilter: "blur(4px)" }}
            >
              HOW IT WORKS?
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#b44dff] animate-pulse" />
            </button>
            <button
              onClick={() => { setIsFlyMode(false); setShowHud(false); setSelectedBuilding(null); setShowHowItWorks(false); setShowVerifyPanel(false); setShowAdsPanel(false); }}
              className="btn-press px-5 sm:px-6 py-2.5 text-[10px] sm:text-[11px] font-pixel font-bold text-black hover:brightness-110 transition-all"
              style={{ border: "2px solid #ff69c7", background: "linear-gradient(135deg, #ff69c7, #ffe45c)", boxShadow: "0 0 16px #ff69c740, 2px 2px 0 0 #8a1a6a" }}
            >
              EXPLORE CITY
            </button>
          </div>
          {/* CTA Row 2: Buy | Database | Ads | Fly */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            <a
              href={SOCIAL_LINKS.buy}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press px-4 py-2 text-[10px] sm:text-[11px] font-pixel font-bold text-black hover:brightness-110 transition-all"
              style={{ border: "2px solid #ffe45c", background: "linear-gradient(135deg, #ffe45c, #ff8a3d)", boxShadow: "0 0 12px #ffe45c40, 2px 2px 0 0 #8a5a1a" }}
            >
              BUY
            </a>
            <button
              onClick={() => { setShowDatabase(true); setSelectedBuilding(null); setShowHowItWorks(false); setShowVerifyPanel(false); setShowAdsPanel(false); }}
              className="btn-press px-4 py-2 text-[10px] sm:text-[11px] font-pixel font-bold text-[#14f195] hover:bg-[#14f195]/15 transition-all"
              style={{ border: "2px solid #14f19560", background: "rgba(10,10,15,0.6)", backdropFilter: "blur(4px)" }}
            >
              DATABASE
            </button>
            <button
              onClick={() => { setShowAdsPanel(true); setSelectedBuilding(null); setShowHowItWorks(false); setShowVerifyPanel(false); }}
              className="btn-press px-4 py-2 text-[10px] sm:text-[11px] font-pixel font-bold text-[#ffe45c] hover:bg-[#ffe45c]/15 transition-all"
              style={{ border: "2px solid #ffe45c60", background: "rgba(10,10,15,0.6)", backdropFilter: "blur(4px)" }}
            >
              ADs
            </button>
            <button
              onClick={() => setIsFlyMode(true)}
              className="btn-press px-4 py-2 text-[10px] sm:text-[11px] font-pixel font-bold text-[#ff2d95] hover:bg-[#ff2d95]/15 transition-all"
              style={{ border: "2px solid #ff2d9560", background: "rgba(10,10,15,0.6)", backdropFilter: "blur(4px)" }}
            >
              FLY
            </button>
          </div>

          {/* Live stats — bigger and more readable */}
          <div className="flex items-center gap-4 sm:gap-6 text-[11px] sm:text-[12px] font-pixel bg-bg/50 backdrop-blur-sm border border-border/30 px-4 py-2 rounded-sm">
            <span className="flex items-center gap-1.5">
              <span className="live-dot h-2 w-2 rounded-full" style={{ backgroundColor: "#14f195" }} />
              <span className="text-[#14f195] font-bold">LIVE</span>
            </span>
            <span className="text-cream">{seedCity.length || "—"} <span className="text-dim">WALLETS</span></span>
            <span className="hidden sm:inline text-cream">
              {seedCity.length > 0 ? `${Math.floor(seedCity.reduce((a, w) => a + w.volumeEstimate, 0)).toLocaleString()}` : "—"} <span className="text-dim">SOL VOL</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══ FLY MODE — CENTER EXIT BUTTON ═══ */}
      {isFlyMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => { setIsFlyMode(false); setShowHud(true); setSelectedBuilding(null); setFocusedBuildingLogin(null); }}
            className="btn-press px-6 py-2.5 text-[10px] font-pixel font-bold text-black rounded-sm"
            style={{
              background: "linear-gradient(135deg, #ff69c7, #ffe45c)",
              boxShadow: "0 0 20px #ff69c740, 2px 2px 0 0 #8a1a6a",
            }}
          >
            ✕ EXIT FLY
          </button>
        </div>
      )}

      {/* ═══ EXPLORE MODE — CENTER EXIT BUTTON ═══ */}
      {!hudVisible && !isFlyMode && !showVerifyPanel && !selectedBuilding && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => { setShowHud(true); setSelectedBuilding(null); setFocusedBuildingLogin(null); }}
            className="btn-press px-6 py-2.5 text-[10px] font-pixel font-bold text-black rounded-sm"
            style={{
              background: "linear-gradient(135deg, #ff69c7, #ffe45c)",
              boxShadow: "0 0 20px #ff69c740, 2px 2px 0 0 #8a1a6a",
            }}
          >
            ✕ EXIT
          </button>
        </div>
      )}

      {/* ═══ HOW IT WORKS — slide-in from right ═══ */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-sm z-[60] transform transition-transform duration-300 ease-out ${
          showHowItWorks ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full bg-bg-card/95 backdrop-blur-lg border-l border-border/50 overflow-y-auto pt-16 pb-8 px-5">
          <button
            onClick={() => setShowHowItWorks(false)}
            className="absolute top-14 right-4 font-pixel text-[10px] text-dim hover:text-cream transition-colors"
          >
            ✕ CLOSE
          </button>

          <h2 className="font-pixel text-lg mb-1">
            <NeonText color="#ff2d95">HOW IT</NeonText>{" "}
            <NeonText color="#ffe45c">WORKS</NeonText>
          </h2>
          <p className="text-[9px] font-pixel text-dim mb-5">No wallet connection needed. Your keys stay safe.</p>

          <div className="space-y-3 mb-6">
            {VERIFY_STEPS.map((vs) => (
              <div key={vs.step} className="flex items-start gap-3 border border-[#b44dff]/15 bg-bg/40 p-3">
                <span
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center font-pixel text-[11px] font-bold"
                  style={{ background: "linear-gradient(135deg, #ff2d9520, #b44dff20)", color: "#ff2d95", border: "1px solid #ff2d9530" }}
                >
                  {vs.step}
                </span>
                <div>
                  <p className="font-pixel text-[10px] text-cream">{vs.title}</p>
                  <p className="font-pixel text-[8px] text-dim">{vs.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-[#14f195]/20 bg-bg/40 p-3 mb-6">
            <p className="text-[9px] font-pixel" style={{ color: "#14f195" }}>
              🔒 Verification uses a unique micro-transaction amount (e.g. 0.001742 SOL) that you send to our donation wallet.
              We match the exact amount to your wallet — no memo needed, works with Phantom and all wallets.
              No refunds — it&apos;s a donation that funds SolCity development.
            </p>
          </div>

          <h3 className="font-pixel text-[11px] text-cream mb-3">ON-CHAIN → CITY</h3>
          <div className="space-y-2">
            {CITY_MAPPINGS.map((cm, i) => (
              <div key={i} className="flex items-center gap-2 text-[9px] font-pixel">
                <span style={{ color: cm.color }}>{cm.icon}</span>
                <span className="text-muted">{cm.metric}</span>
                <span className="text-dim">→</span>
                <span style={{ color: cm.color }}>{cm.city}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ VERIFY PANEL — slide-in from left ═══ */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-full max-w-md z-[60] transform transition-transform duration-300 ease-out ${
          showVerifyPanel ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full bg-bg-card/95 backdrop-blur-lg border-r border-border/50 overflow-y-auto pt-16 pb-8 px-5">
          <button
            onClick={resetDeploy}
            className="absolute top-14 right-4 font-pixel text-[10px] text-dim hover:text-cream transition-colors"
          >
            ✕ CLOSE
          </button>

          <h2 className="font-pixel text-xl sm:text-2xl mb-1">
            <NeonText color="#b44dff">DEPLOY</NeonText>{" "}
            <NeonText color="#ff2d95">CITY</NeonText>
          </h2>
          <p className="text-[10px] font-pixel text-dim mb-4">
            Wallet: <span className="text-cream font-bold">{shortenAddr(walletAddress)}</span>
          </p>

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-5">
            {VERIFY_STEPS.map((vs) => (
              <div key={vs.step} className="flex-1">
                <div
                  className="h-1.5 transition-all duration-500"
                  style={{
                    background: verifyStep >= vs.step ? "linear-gradient(90deg, #ff2d95, #b44dff)" : "#2a2040",
                    boxShadow: verifyStep >= vs.step ? "0 0 8px #ff2d9560" : "none",
                  }}
                />
                <p className="text-[8px] font-pixel mt-1" style={{ color: verifyStep >= vs.step ? "#ff2d95" : "#6c5c8c" }}>
                  {vs.title}
                </p>
              </div>
            ))}
          </div>

          {/* ═══ EXACT AMOUNT — PROMINENT ═══ */}
          <div className="border-2 border-[#ff2d95]/50 bg-[#ff2d95]/5 p-4 mb-4" style={{ boxShadow: "0 0 15px #ff2d9520" }}>
            <p className="text-[11px] font-pixel text-[#ff2d95] font-bold mb-2 tracking-wider">💰 SEND THIS EXACT AMOUNT:</p>
            <code className="text-[24px] sm:text-[28px] font-pixel text-[#ff2d95] font-bold block mb-1 text-center">{verifyAmount} SOL</code>
            <p className="text-[8px] font-pixel text-dim mb-3 text-center">The unique amount is how we verify your wallet — no memo needed!</p>
            <button
              onClick={() => copyToClipboard(verifyAmount, "amount")}
              className="btn-press border-2 border-[#ff2d95]/40 px-4 py-2 text-[10px] font-pixel text-[#ff2d95] hover:bg-[#ff2d95]/10 w-full font-bold"
            >
              {copied === "amount" ? "✓ COPIED!" : "COPY AMOUNT"}
            </button>
          </div>

          {/* ═══ DONATION WALLET — PROMINENT ═══ */}
          <div className="border-2 border-[#14f195]/50 bg-[#14f195]/5 p-4 mb-5" style={{ boxShadow: "0 0 15px #14f19520" }}>
            <p className="text-[11px] font-pixel text-[#14f195] font-bold mb-2 tracking-wider">⚡ TO THIS WALLET:</p>
            <code className="text-[11px] sm:text-[12px] font-pixel text-[#14f195] break-all leading-relaxed block mb-3 font-bold">{DONATION_WALLET}</code>
            <button
              onClick={() => copyToClipboard(DONATION_WALLET, "wallet")}
              className="btn-press border-2 border-[#14f195]/40 px-4 py-2 text-[10px] font-pixel text-[#14f195] hover:bg-[#14f195]/10 w-full font-bold"
            >
              {copied === "wallet" ? "✓ COPIED!" : "COPY WALLET ADDRESS"}
            </button>
          </div>

          {/* Manual confirm or status */}
          {verifyStep === 1 && (
            <button
              onClick={confirmSent}
              className="btn-press w-full py-3 text-[12px] font-pixel font-bold text-black mb-4"
              style={{ background: "linear-gradient(135deg, #14f195, #00f0ff)", boxShadow: "0 0 15px #14f19540" }}
            >
              I&apos;VE SENT THE TRANSACTION →
            </button>
          )}
          {verifyStep === 2 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 py-2">
                <span className="inline-block w-3 h-3 border-2 border-[#ff2d95] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="text-[11px] text-muted font-pixel">{verifyMessage || "Watching blockchain..."}</span>
              </div>
              <p className="text-[8px] font-pixel text-dim mt-1">Polling every 5 seconds. Do not close this panel.</p>
              <button
                onClick={() => {
                  if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                  setVerifyPolling(false);
                  setVerifyStep(1);
                  setVerifyMessage("");
                }}
                className="btn-press mt-2 border border-border/30 px-3 py-1 text-[9px] font-pixel text-dim hover:text-cream"
              >
                ← BACK (RE-SEND)
              </button>
            </div>
          )}
          {verifyStep === 3 && (
            <div className="flex items-center gap-2 mb-4 py-2">
              <span className="text-[14px]">✓</span>
              <span className="text-[11px] font-pixel" style={{ color: "#14f195" }}>{verifyMessage || "Transaction verified!"}</span>
            </div>
          )}

          {/* ═══ DEPLOY COMPLETE ═══ */}
          {deployComplete && (
            <div className="border-2 border-[#14f195]/40 bg-[#14f195]/5 p-4 mb-4" style={{ boxShadow: "0 0 15px #14f19520" }}>
              <p className="text-[13px] font-pixel font-bold mb-3" style={{ color: "#14f195" }}>
                ✓ WALLET VERIFIED — CITY DEPLOYED!
              </p>

              {/* Nickname prompt */}
              {showNicknamePrompt && (
                <div className="mb-3">
                  <p className="text-[9px] font-pixel text-dim mb-1.5">Give your city a name:</p>
                  <div className="flex gap-2">
                    <input
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && nicknameInput.trim()) { saveNickname(walletAddress, nicknameInput); setShowNicknamePrompt(false); } }}
                      placeholder="e.g. Diamond Hands HQ"
                      className="flex-1 bg-bg/60 border border-border/40 px-2 py-1.5 text-[10px] font-pixel text-cream placeholder:text-dim outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => { if (nicknameInput.trim()) { saveNickname(walletAddress, nicknameInput); setShowNicknamePrompt(false); } }}
                      className="btn-press border border-[#14f195]/40 px-3 py-1 text-[9px] font-pixel text-[#14f195]"
                    >
                      SAVE
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <a
                  href={`https://x.com/intent/tweet?text=${tweetText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-press w-full py-2.5 text-[10px] font-pixel font-bold text-center border-2 border-[#ff2d95]/50 text-[#ff2d95] hover:bg-[#ff2d95]/10"
                >
                  📣 TWEET YOUR CITY
                </a>
                <button
                  onClick={() => {
                    setFocusedBuildingLogin(walletAddress);
                    setShowVerifyPanel(false);
                    setShowHud(false);
                    setSelectedBuilding(null);
                    setIsFlyMode(false);
                  }}
                  className="btn-press w-full py-2.5 text-[10px] font-pixel font-bold text-black"
                  style={{ background: "linear-gradient(135deg, #ff69c7, #ffe45c)" }}
                >
                  📍 LOCATE YOUR BUILDING
                </button>
                <button
                  onClick={resetDeploy}
                  className="btn-press w-full py-2 text-[9px] font-pixel text-dim hover:text-cream border border-border/30"
                >
                  DEPLOY ANOTHER WALLET
                </button>
              </div>
            </div>
          )}

          {/* Metrics preview */}
          {walletData && (
            <div className="mt-4 border-t border-border/30 pt-4">
              <h3 className="font-pixel text-[11px] text-cream mb-3">WALLET METRICS</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Transactions", value: walletData.totalTransactions.toLocaleString(), color: "#ff2d95" },
                  { label: "Volume", value: `${walletData.volumeEstimate.toLocaleString(undefined, { maximumFractionDigits: 1 })} SOL`, color: "#b44dff" },
                  { label: "PnL", value: `${walletData.pnlUsd >= 0 ? "+" : ""}$${Math.abs(walletData.pnlUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}${walletData.pnlIsReal ? "" : " EST"}`, color: walletData.pnlUsd >= 0 ? "#14f195" : "#ff2d95" },
                  { label: "Win Rate", value: `${(walletData.winRate * 100).toFixed(1)}%`, color: "#9945ff" },
                  { label: "Tokens", value: walletData.tokenCount.toString(), color: "#00f0ff" },
                  { label: "Degen Score", value: `${walletData.degenScore}/100`, color: "#b44dff" },
                ].map((m, i) => (
                  <div key={i} className="border border-border/20 bg-bg/30 p-2">
                    <p className="text-[8px] font-pixel text-dim uppercase">{m.label}</p>
                    <p className="text-[12px] font-pixel font-bold" style={{ color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ BUILDING INFO PANEL — slide-in from right (like GitCity) ═══ */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-sm z-[60] transform transition-transform duration-300 ease-out ${
          selectedBuilding ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full bg-bg-card/95 backdrop-blur-lg border-l border-border/50 overflow-y-auto pt-16 pb-8 px-5">
          <button
            onClick={() => { setSelectedBuilding(null); setFocusedBuildingLogin(null); setShowHud(true); setEditingNickname(false); }}
            className="absolute top-14 right-4 font-pixel text-[10px] text-dim hover:text-cream transition-colors"
          >
            ESC CLOSE
          </button>

          {selectedBuilding && (
            <>
              {/* Name / Address */}
              <h2 className="font-pixel text-base sm:text-lg text-cream mb-0.5 leading-tight">
                {displayName(selectedBuilding)}
              </h2>
              <p className="text-[9px] font-pixel text-dim mb-1">{shortenAddr(selectedBuilding.address)}</p>
              <button
                onClick={() => copyToClipboard(selectedBuilding.address, "addr")}
                className="text-[8px] font-pixel text-[#00f0ff]/60 hover:text-[#00f0ff] transition-colors mb-3"
              >
                {copied === "addr" ? "COPIED!" : "COPY FULL ADDRESS"}
              </button>

              {/* Nickname edit */}
              {editingNickname ? (
                <div className="flex gap-2 mb-4">
                  <input
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveNickname(selectedBuilding.address, nicknameInput)}
                    placeholder="Enter nickname..."
                    className="flex-1 bg-bg/60 border border-border/40 px-2 py-1.5 text-[10px] font-pixel text-cream placeholder:text-dim outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => saveNickname(selectedBuilding.address, nicknameInput)}
                    className="btn-press border border-[#14f195]/40 px-2 py-1 text-[8px] font-pixel text-[#14f195]"
                  >
                    SAVE
                  </button>
                  <button
                    onClick={() => setEditingNickname(false)}
                    className="btn-press border border-border/40 px-2 py-1 text-[8px] font-pixel text-dim"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingNickname(true); setNicknameInput(nicknames[selectedBuilding.address] || ""); }}
                  className="text-[8px] font-pixel text-[#b44dff]/60 hover:text-[#b44dff] transition-colors mb-4 block"
                >
                  ✏ {nicknames[selectedBuilding.address] ? "EDIT" : "SET"} NICKNAME
                </button>
              )}

              {/* Degen Score bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-pixel text-dim">DEGEN SCORE</span>
                  <span className="text-[10px] font-pixel font-bold" style={{ color: "#b44dff" }}>
                    {selectedBuilding.degenScore}/100
                  </span>
                </div>
                <div className="h-1.5 w-full bg-bg-raised overflow-hidden">
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${selectedBuilding.degenScore}%`,
                      background: "linear-gradient(90deg, #ff2d95, #b44dff)",
                      boxShadow: "0 0 6px #ff2d9550",
                    }}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: "TRANSACTIONS", value: selectedBuilding.totalTransactions.toLocaleString(), color: "#ff2d95" },
                  { label: "VOLUME (SOL)", value: selectedBuilding.volumeEstimate.toLocaleString(undefined, { maximumFractionDigits: 1 }), color: "#b44dff" },
                  { label: "PNL", value: `${selectedBuilding.pnlUsd >= 0 ? "+" : ""}$${Math.abs(selectedBuilding.pnlUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}${selectedBuilding.pnlIsReal ? "" : " EST"}`, color: selectedBuilding.pnlUsd >= 0 ? "#14f195" : "#ff2d95" },
                  { label: "WIN RATE", value: `${(selectedBuilding.winRate * 100).toFixed(1)}%`, color: "#9945ff" },
                  { label: "TOKENS", value: selectedBuilding.tokenCount.toString(), color: "#00f0ff" },
                  { label: "NFTS", value: selectedBuilding.nftCount.toString(), color: "#ff2d95" },
                  { label: "RUGS SURVIVED", value: selectedBuilding.rugsSurvived.toString(), color: "#00f0ff" },
                  { label: "AVG HOLD", value: selectedBuilding.avgHoldTime, color: "#14f195" },
                ].map((m, i) => (
                  <div key={i} className="border border-border/20 bg-bg/30 p-2.5">
                    <p className="text-[7px] font-pixel text-dim uppercase tracking-wider">{m.label}</p>
                    <p className="text-[12px] font-pixel font-bold mt-0.5" style={{ color: m.color, textShadow: `0 0 8px ${m.color}30` }}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* City stats */}
              <div className="border-t border-border/20 pt-3">
                <h3 className="text-[9px] font-pixel text-cream mb-2">CITY ARCHITECTURE</h3>
                <div className="space-y-1.5 text-[9px] font-pixel">
                  <div className="flex justify-between"><span className="text-dim">Buildings</span><span className="text-cream">{selectedBuilding.buildingCount}</span></div>
                  <div className="flex justify-between"><span className="text-dim">Districts</span><span className="text-cream">{selectedBuilding.districtCount}</span></div>
                  <div className="flex justify-between"><span className="text-dim">Skyscraper Height</span><span className="text-cream">{selectedBuilding.skyscraperHeight}m</span></div>
                  <div className="flex justify-between"><span className="text-dim">Parks</span><span className="text-cream">{selectedBuilding.parkCount}</span></div>
                  {selectedBuilding.hasNeonDistrict && (
                    <div className="flex justify-between">
                      <span className="text-dim">Special</span>
                      <span style={{ color: "#ff2d95" }}>NEON DISTRICT</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ ADs PANEL — slide-in from right ═══ */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-sm z-[60] transform transition-transform duration-300 ease-out ${
          showAdsPanel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full bg-bg-card/95 backdrop-blur-lg border-l border-border/50 overflow-y-auto pt-16 pb-8 px-5">
          <button
            onClick={() => setShowAdsPanel(false)}
            className="absolute top-14 right-4 font-pixel text-[10px] text-dim hover:text-cream transition-colors"
          >
            ✕ CLOSE
          </button>

          <h2 className="font-pixel text-lg mb-1">
            <NeonText color="#ffe45c">ADVERTISE</NeonText>{" "}
            <NeonText color="#ff2d95">IN THE SOLANA SKYLINE</NeonText>
          </h2>
          <p className="text-[9px] font-pixel text-dim mb-5">
            Place your brand inside SolCity. Powered by x402 micropayments in USDC.
          </p>

          <div className="space-y-3 mb-5">
            {[
              { id: "plane", name: "Sky Plane", emoji: "✈️", desc: "Banner trails flying over the city skyline", price: 15, color: "#ff2d95" },
              { id: "blimp", name: "Blimp", emoji: "🎈", desc: "Floating blimp with your logo above the city center", price: 20, color: "#b44dff" },
              { id: "billboard", name: "Billboard", emoji: "📺", desc: "Neon billboard on the main highway through districts", price: 25, color: "#ffe45c" },
              { id: "ledwrap", name: "LED Building Wrap", emoji: "💡", desc: "Wrap an entire skyscraper with your animated ad", price: 8, color: "#14f195" },
            ].map((ad) => {
              const cartItem = adCart.find(c => c.id === ad.id);
              const inCart = !!cartItem;
              return (
                <div
                  key={ad.id}
                  className="border bg-bg/40 p-4 transition-colors"
                  style={{ borderColor: inCart ? ad.color : `${ad.color}30` }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{ad.emoji}</span>
                    <div className="flex-1">
                      <p className="font-pixel text-[11px] font-bold" style={{ color: ad.color }}>{ad.name}</p>
                      <p className="font-pixel text-[8px] text-dim">{ad.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-pixel text-[10px] text-cream">{ad.price} USDC / day</span>
                    <button
                      onClick={() => {
                        setAdCart(prev =>
                          inCart
                            ? prev.filter(c => c.id !== ad.id)
                            : [...prev, { id: ad.id, name: ad.name, price: ad.price, days: 1 }]
                        );
                      }}
                      className="btn-press font-pixel text-[8px] px-3 py-1 rounded-sm transition-colors"
                      style={{
                        background: inCart ? ad.color : "transparent",
                        color: inCart ? "#0a0a0f" : ad.color,
                        border: `1px solid ${ad.color}60`,
                      }}
                    >
                      {inCart ? "✓ ADDED" : "+ ADD"}
                    </button>
                  </div>
                  {inCart && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t" style={{ borderColor: `${ad.color}20` }}>
                      <span className="font-pixel text-[8px] text-dim">DAYS:</span>
                      <button
                        onClick={() => setAdCart(prev => prev.map(c => c.id === ad.id ? { ...c, days: Math.max(1, c.days - 1) } : c))}
                        className="btn-press w-5 h-5 flex items-center justify-center font-pixel text-[10px] rounded-sm"
                        style={{ border: `1px solid ${ad.color}40`, color: ad.color }}
                      >
                        -
                      </button>
                      <span className="font-pixel text-[10px] text-cream font-bold w-6 text-center">{cartItem.days}</span>
                      <button
                        onClick={() => setAdCart(prev => prev.map(c => c.id === ad.id ? { ...c, days: c.days + 1 } : c))}
                        className="btn-press w-5 h-5 flex items-center justify-center font-pixel text-[10px] rounded-sm"
                        style={{ border: `1px solid ${ad.color}40`, color: ad.color }}
                      >
                        +
                      </button>
                      <span className="font-pixel text-[8px] ml-auto" style={{ color: ad.color }}>
                        {cartItem.days * ad.price} USDC
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Shopping Cart */}
          {adCart.length > 0 && (
            <div className="border border-[#ffe45c]/30 bg-[#ffe45c]/5 p-3 mb-4 rounded-sm">
              <p className="font-pixel text-[9px] text-[#ffe45c] font-bold mb-2">🛒 YOUR CART</p>
              {adCart.map(item => (
                <div key={item.id} className="flex justify-between items-center mb-1">
                  <span className="font-pixel text-[8px] text-cream">{item.name} <span className="text-dim">x{item.days}d</span></span>
                  <span className="font-pixel text-[8px] text-dim">{item.price * item.days} USDC</span>
                </div>
              ))}
              <div className="border-t border-[#ffe45c]/20 mt-2 pt-2 flex justify-between items-center">
                <span className="font-pixel text-[9px] text-cream font-bold">TOTAL</span>
                <span className="font-pixel text-[10px] text-[#ffe45c] font-bold">
                  {adCart.reduce((s, c) => s + c.price * c.days, 0)} USDC
                </span>
              </div>
            </div>
          )}

          {/* Connect Wallet Button */}
          <div className="relative group mb-5">
            <button
              onClick={() => {}}
              className="btn-press w-full py-2.5 text-[10px] font-pixel font-bold rounded-sm transition-colors"
              style={{
                background: "linear-gradient(135deg, #b44dff, #ff69c7)",
                color: "#0a0a0f",
                opacity: 0.7,
                cursor: "not-allowed",
              }}
            >
              🔗 CONNECT WALLET TO PAY
            </button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1520] border border-[#b44dff]/40 px-3 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <span className="font-pixel text-[7px] text-[#b44dff]">Releasing soon</span>
            </div>
          </div>

          <div className="border border-[#ff8a3d]/20 bg-bg/40 p-3 mb-4">
            <p className="text-[10px] font-pixel text-[#ff8a3d] font-bold mb-1">x402 PAYMENTS</p>
            <p className="text-[9px] font-pixel text-dim leading-relaxed">
              All ad placements are paid via x402 micropayments in USDC on Solana.
              No middlemen. Instant activation. Pay per impression or per day.
              Your ad goes live the moment the transaction confirms.
            </p>
          </div>

          <div className="border border-[#b44dff]/20 bg-bg/40 p-3">
            <p className="text-[10px] font-pixel text-[#b44dff] font-bold mb-1">INTERESTED?</p>
            <p className="text-[9px] font-pixel text-dim mb-2">
              DM us on X to reserve your ad slot in SolCity.
            </p>
            <a
              href={SOCIAL_LINKS.x}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-block border border-[#ff2d95]/40 px-4 py-1.5 text-[9px] font-pixel text-[#ff2d95] hover:bg-[#ff2d95]/10"
            >
              DM ON 𝕏
            </a>
          </div>
        </div>
      </div>

      {/* ═══ ERROR TOAST ═══ */}
      {fetchError && (
        <div className="fixed top-14 inset-x-0 z-[70] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto border border-red-500/40 bg-bg-card/90 backdrop-blur-sm px-4 py-2 flex items-center gap-3 animate-[fade-in_0.2s_ease-out]">
            <p className="text-[9px] font-pixel text-red-400">{fetchError}</p>
            <button onClick={() => { setFetchError(""); setVerifyStep(0); }} className="text-[8px] font-pixel text-dim hover:text-cream">✕</button>
          </div>
        </div>
      )}

      {/* ═══ DATABASE PANEL ═══ */}
      {showDatabase && (
        <DatabasePanel
          wallets={seedCity}
          nicknames={nicknames}
          onNavigate={(w) => {
            setFocusedBuildingLogin(w.address);
            setSelectedBuilding(w);
            setShowDatabase(false);
          }}
          onClose={() => setShowDatabase(false)}
        />
      )}

      {/* ═══ BOTTOM STATS BAR ═══ */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 pointer-events-none transition-all duration-300 ${isFlyMode ? "opacity-0 translate-y-full" : "opacity-100"}`}>
        <div className="flex items-center justify-center gap-5 sm:gap-8 px-4 py-2.5 bg-bg/40 backdrop-blur-sm border-t border-border/30">
          <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-pixel">
            <span className="live-dot h-2 w-2 rounded-full" style={{ backgroundColor: "#14f195" }} />
            <span className="text-[#14f195] font-bold">LIVE</span>
          </span>
          <span className="text-[10px] sm:text-[11px] font-pixel text-cream/70">
            <span className="text-cream font-bold">{seedCity.length}</span> WALLETS
          </span>
          <span className="text-[10px] sm:text-[11px] font-pixel text-cream/70 hidden sm:inline">
            TOKEN CA: <span className="text-[#b44dff]">Coming Soon</span>
          </span>
        </div>
      </div>
    </main>
  );
}
