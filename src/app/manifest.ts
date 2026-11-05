import type { MetadataRoute } from "next";
import en from "@/i18n/messages/en.json";

/**
 * Web app manifest (spec 003, FR-010, contracts/ui-theme.md §7). One manifest per origin, so its texts come from the
 * default language's dictionary (Principle VI: no hand-written strings).
 * Installed app = Neon (the default theme): icons, toolbar and splash colors. An installed app's icon is fixed at
 * install time, so it can't follow a later theme change; the browser tab icon does (setNeonFavicon).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: en.common.appName,
    short_name: en.common.appShortName,
    description: en.common.appDescription,
    start_url: "/dashboard",
    display: "standalone",
    theme_color: "#0A0A0A",
    background_color: "#0A0A0A",
    icons: [
      { src: "/icons/icon-neon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-neon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-neon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
