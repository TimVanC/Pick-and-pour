import type { MetadataRoute } from "next";

/** Lets the bartender app be installed to a tablet or phone home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pick & Pour",
    short_name: "Pick & Pour",
    description: "Run Pick & Pour behind the bar.",
    start_url: "/app",
    display: "standalone",
    background_color: "#15171c",
    theme_color: "#15171c",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
