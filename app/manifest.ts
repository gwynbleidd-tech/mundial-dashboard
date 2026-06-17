import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Porra Mundial 2026",
    short_name: "Porra 2026",
    description: "Dashboard de predicciones del Mundial 2026",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7EE",
    theme_color: "#1B5E3A",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
