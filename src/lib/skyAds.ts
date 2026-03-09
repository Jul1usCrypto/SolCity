export type AdVehicle = "plane" | "blimp" | "billboard" | "rooftop_sign" | "led_wrap";

export interface SkyAd {
  id: string;
  text: string;
  brand?: string;
  description?: string;
  color: string;
  bgColor: string;
  link?: string;
  vehicle: AdVehicle;
  priority: number;
}

export const MAX_PLANES = 8;
export const MAX_BLIMPS = 4;
export const MAX_BILLBOARDS = 10;
export const MAX_ROOFTOP_SIGNS = 20;
export const MAX_LED_WRAPS = 10;
export const MAX_TEXT_LENGTH = 80;

const ALLOWED_LINK_PATTERN = /^(https:\/\/|mailto:)/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isBuildingAd(vehicle: string): vehicle is "billboard" | "rooftop_sign" | "led_wrap" {
  return vehicle === "billboard" || vehicle === "rooftop_sign" || vehicle === "led_wrap";
}

export function validateAds(ads: SkyAd[]): SkyAd[] {
  return ads
    .filter((ad) => {
      if (ad.text.length > MAX_TEXT_LENGTH) return false;
      if (ad.link && !ALLOWED_LINK_PATTERN.test(ad.link)) return false;
      if (!HEX_COLOR_PATTERN.test(ad.color)) return false;
      if (!HEX_COLOR_PATTERN.test(ad.bgColor)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
}

export function getActiveAds(ads: SkyAd[]) {
  const valid = validateAds(ads);
  return {
    planeAds: valid.filter((a) => a.vehicle === "plane").slice(0, MAX_PLANES),
    blimpAds: valid.filter((a) => a.vehicle === "blimp").slice(0, MAX_BLIMPS),
    billboardAds: valid.filter((a) => a.vehicle === "billboard").slice(0, MAX_BILLBOARDS),
    rooftopSignAds: valid.filter((a) => a.vehicle === "rooftop_sign").slice(0, MAX_ROOFTOP_SIGNS),
    ledWrapAds: valid.filter((a) => a.vehicle === "led_wrap").slice(0, MAX_LED_WRAPS),
  };
}

/** Append UTM params to an ad link. Skips mailto: links. */
export function buildAdLink(ad: SkyAd): string | undefined {
  if (!ad.link) return undefined;
  if (ad.link.startsWith("mailto:")) return ad.link;
  try {
    const url = new URL(ad.link);
    url.searchParams.set("utm_source", "gitcity");
    url.searchParams.set("utm_medium", "sky_ad");
    url.searchParams.set("utm_campaign", ad.id);
    url.searchParams.set("utm_content", ad.vehicle);
    return url.toString();
  } catch {
    return ad.link;
  }
}

/** Fire a tracking beacon to the sky-ads track API (non-blocking). */
export function trackAdEvent(adId: string, eventType: "impression" | "click" | "cta_click", githubLogin?: string) {
  const body = JSON.stringify({ ad_id: adId, event_type: eventType, ...(githubLogin && { github_login: githubLogin }) });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/sky-ads/track", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/sky-ads/track", { method: "POST", body, keepalive: true }).catch(() => {});
  }
}

/** Fire multiple event types in a single beacon (saves rate limit budget). */
export function trackAdEvents(adId: string, eventTypes: ("impression" | "click" | "cta_click")[], githubLogin?: string) {
  const body = JSON.stringify({ ad_id: adId, event_types: eventTypes, ...(githubLogin && { github_login: githubLogin }) });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/sky-ads/track", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/sky-ads/track", { method: "POST", body, keepalive: true }).catch(() => {});
  }
}

export const DEFAULT_SKY_ADS: SkyAd[] = [
  // ── Planes ──
  {
    id: "solcity-main",
    text: "SOLCITY ★ Visualizing the Solana Skyline ★ SOLCITY.CITY",
    brand: "SolCity",
    color: "#ff69c7",
    bgColor: "#1a0a18",
    link: "https://solcity.city",
    vehicle: "plane",
    priority: 100,
  },
  {
    id: "hodl",
    text: "HODL ★ DIAMOND HANDS NEVER FOLD ★ HODL",
    brand: "Crypto Culture",
    color: "#00f0ff",
    bgColor: "#0a0a1a",
    vehicle: "plane",
    priority: 90,
  },
  {
    id: "pump-it",
    text: "PUMP IT 🚀 TO THE MOON 🌙 PUMP IT",
    brand: "Degen Airways",
    color: "#14f195",
    bgColor: "#0a1a0f",
    vehicle: "plane",
    priority: 85,
  },
  {
    id: "gm-plane",
    text: "GM ☀ WAGMI ★ SOLANA Trenches are it! ★ GM",
    brand: "GM Airlines",
    color: "#ffe45c",
    bgColor: "#1a1508",
    vehicle: "plane",
    priority: 80,
  },
  // ── Blimps ──
  {
    id: "sol-blimp",
    text: "SOLANA x Pumpfun",
    brand: "Solana",
    color: "#b44dff",
    bgColor: "#0f0a1a",
    vehicle: "blimp",
    priority: 95,
  },
  {
    id: "degen-blimp",
    text: "DEGEN SCORE: 100 — ARE YOU WORTHY?",
    brand: "SolCity Degens",
    color: "#ff2d95",
    bgColor: "#1a0510",
    vehicle: "blimp",
    priority: 75,
  },
  {
    id: "ngmi-blimp",
    text: "PAPER HANDS = NGMI ★ STAY STRONG",
    brand: "Diamond District",
    color: "#00f0ff",
    bgColor: "#0a0a1a",
    vehicle: "blimp",
    priority: 70,
  },
  // ── Billboards ──
  {
    id: "ad-billboard",
    text: "YOUR AD HERE — FLY OVER SOLCITY",
    brand: "SolCity Ads",
    description: "Planes, blimps, billboards. x402 micropayments in USDC.",
    color: "#ffe45c",
    bgColor: "#1a1508",
    vehicle: "billboard",
    priority: 60,
  },
  {
    id: "lfg-billboard",
    text: "Downsin = Black",
    brand: "Solana Devs",
    color: "#14f195",
    bgColor: "#0a1a0f",
    vehicle: "billboard",
    priority: 55,
  },
  // ── Rooftop Signs (scattered across buildings) ──
  {
    id: "whale-rooftop",
    text: "WHALE ALERT 🐋",
    brand: "On-Chain Intel",
    color: "#00f0ff",
    bgColor: "#0a0a1a",
    vehicle: "rooftop_sign",
    priority: 50,
  },
  {
    id: "nfa-rooftop",
    text: "No Jeets allowed",
    brand: "Crypto Wisdom",
    color: "#ff69c7",
    bgColor: "#1a0a18",
    vehicle: "rooftop_sign",
    priority: 48,
  },
  {
    id: "gm-rooftop",
    text: "GM SOLANA ☀",
    brand: "GM Gang",
    color: "#ffe45c",
    bgColor: "#1a1508",
    vehicle: "rooftop_sign",
    priority: 46,
  },
  {
    id: "diamond-rooftop",
    text: "💎 DIAMOND HANDS 💎",
    brand: "HODL District",
    color: "#b44dff",
    bgColor: "#0f0a1a",
    vehicle: "rooftop_sign",
    priority: 44,
  },
  {
    id: "wen-rooftop",
    text: "WEN MOON? 🌙",
    brand: "Degen HQ",
    color: "#ff2d95",
    bgColor: "#1a0510",
    vehicle: "rooftop_sign",
    priority: 42,
  },
  {
    id: "wagmi-rooftop",
    text: "WAGMI 🚀",
    brand: "Solana Maxis",
    color: "#14f195",
    bgColor: "#0a1a0f",
    vehicle: "rooftop_sign",
    priority: 40,
  },
  {
    id: "sol-rooftop",
    text: "SOL > ETH",
    brand: "Chain Wars",
    color: "#b44dff",
    bgColor: "#0f0a1a",
    vehicle: "rooftop_sign",
    priority: 38,
  },
  {
    id: "degen-rooftop",
    text: "BORN TO DEGEN",
    brand: "Ape District",
    color: "#ff8a3d",
    bgColor: "#1a1008",
    vehicle: "rooftop_sign",
    priority: 36,
  },
  {
    id: "ngmi-rooftop",
    text: "SELLERS = NGMI",
    brand: "Bull Market",
    color: "#ff2d95",
    bgColor: "#1a0510",
    vehicle: "rooftop_sign",
    priority: 34,
  },
  {
    id: "lfg-rooftop",
    text: "LFG 🔥🔥🔥",
    brand: "Send It",
    color: "#ffe45c",
    bgColor: "#1a1508",
    vehicle: "rooftop_sign",
    priority: 32,
  },
  // ── KOL Name Signs (placed on top/center buildings) ──
  {
    id: "kol-cented",
    text: "CENTED #1 KOL",
    brand: "Cented",
    color: "#ff2d95",
    bgColor: "#1a0510",
    vehicle: "rooftop_sign",
    priority: 30,
  },
  {
    id: "kol-cowboy",
    text: "COWBOY ★ TOP DEGEN",
    brand: "Cowboy",
    color: "#b44dff",
    bgColor: "#0f0a1a",
    vehicle: "rooftop_sign",
    priority: 28,
  },
  {
    id: "kol-theo",
    text: "THEO WAS HERE",
    brand: "theo",
    color: "#ffe45c",
    bgColor: "#1a1508",
    vehicle: "rooftop_sign",
    priority: 26,
  },
  {
    id: "kol-cooker",
    text: "COOKER COOKIN 🍳",
    brand: "Cooker",
    color: "#14f195",
    bgColor: "#0a1a0f",
    vehicle: "rooftop_sign",
    priority: 24,
  },
  {
    id: "kol-scharo",
    text: "SCHARO ★ LEGEND",
    brand: "Scharo",
    color: "#ff69c7",
    bgColor: "#1a0a18",
    vehicle: "rooftop_sign",
    priority: 22,
  },
  // ── More Meme Quotes ──
  {
    id: "copium-rooftop",
    text: "INJECT COPIUM 💉",
    brand: "Cope District",
    color: "#ff8a3d",
    bgColor: "#1a1008",
    vehicle: "rooftop_sign",
    priority: 20,
  },
  {
    id: "rug-rooftop",
    text: "RUG PROOF 🛡",
    brand: "SafeZone",
    color: "#14f195",
    bgColor: "#0a1a0f",
    vehicle: "rooftop_sign",
    priority: 18,
  },
  {
    id: "dip-rooftop",
    text: "BUY THE DIP 📉📈",
    brand: "BTD Gang",
    color: "#b44dff",
    bgColor: "#0f0a1a",
    vehicle: "rooftop_sign",
    priority: 16,
  },
  {
    id: "alpha-rooftop",
    text: "FREE ALPHA HERE",
    brand: "Alpha Leak",
    color: "#ffe45c",
    bgColor: "#1a1508",
    vehicle: "rooftop_sign",
    priority: 14,
  },
  {
    id: "trenches-rooftop",
    text: "SOLANA TRENCHES 🪖",
    brand: "Trench Gang",
    color: "#ff2d95",
    bgColor: "#1a0510",
    vehicle: "rooftop_sign",
    priority: 12,
  },
];
