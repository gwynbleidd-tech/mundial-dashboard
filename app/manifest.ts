import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Porra Clipeto",
    short_name: "Porra Clipeto",
    description: "Dashboard de predicciones del Mundial 2026",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7EE",
    theme_color: "#1B5E3A",
    icons: [
      { src: "/clipeto/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { src: "/clipeto/icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
