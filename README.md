<h1 align="center">
  <img src="public/solcity-pfp.png" alt="SolCity" width="80" /><br/>
  SolCity
</h1>

<p align="center">
  <strong>Visualizing the Solana Skyline</strong>
</p>

<p align="center">
  <a href="https://solcity.city">solcity.city</a> · <a href="https://x.com/SolC1ty">@SolC1ty</a>
</p>

<p align="center">
  <img src="public/solcity-banner.png" alt="SolCity — Visualizing the Solana Skyline" width="800" />
</p>

---

## What is SolCity?

SolCity transforms your Solana wallet activity into a living 3D cyberpunk city. Volume determines city size, PnL shapes skyscraper height, trades set building count, and token diversity creates districts. Verify your wallet, deploy your building, explore the skyline.

## Features

- **3D Wallet City** — On-chain metrics mapped to building height, width, density & districts
- **Wallet Verification** — Amount-based SOL verification to deploy your building
- **Free Flight Mode** — Fly through the city and explore the neon skyline
- **Sky Ads** — Planes, blimps, billboards, rooftop signs & LED wraps with crypto culture
- **Explore & Search** — Find any wallet by address, name, or nickname
- **KOL Showcase** — Top 40 Solana KOL wallets seeded as the city center

## How Buildings Work

| Wallet Metric    | City Element        |
|------------------|---------------------|
| Volume (SOL)     | City Size           |
| PnL              | Skyscraper Height   |
| Total Trades     | Building Count      |
| Token Diversity  | Districts           |

## Tech Stack

- **Next.js 16** (App Router, Turbopack) + **Three.js** / react-three-fiber
- **Helius API** for Solana RPC & wallet data
- **Tailwind CSS v4** with pixel font (Silkscreen)
- **Vercel** for hosting

## Getting Started

```bash
git clone https://github.com/Jul1usCrypto/SolCity.git
cd SolCity
npm install
cp .env.example .env.local   # Add your HELIUS_API_KEY
npm run dev
```

## License

[AGPL-3.0](LICENSE)

---

<p align="center">
  <a href="https://solcity.city">solcity.city</a>
</p>
