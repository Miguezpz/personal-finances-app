import type { MetadataRoute } from "next";
import en from "@/i18n/messages/en.json";

/**
 * Web app manifest (spec 003, FR-010, contracts/ui-theme.md §7). One manifest per origin, so its texts come from the
 * default language's dictionary (Principle VI: no hand-written strings).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: en.common.appName,
    short_name: en.common.appShortName,
    description: en.common.appDescription,
    start_url: "/dashboard",
    display: "standalone",
    theme_color: "#0F766E",
    background_color: "#ECFDF5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
