import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SolCity",
    short_name: "SolCity",
    description:
      "Your Solana wallet activity transformed into a living 3D cyberpunk city. Visualizing the Solana Skyline.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#ff69c7",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
