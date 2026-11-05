import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InlineScript } from "@/components/layout/InlineScript";
import en from "@/i18n/messages/en.json";
import { PREFERENCES_BOOT_SCRIPT } from "@/store/effects";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// No static `title`: it follows the language (DocumentTitle in providers.tsx; the inline boot
// script sets it before the first paint).
export const metadata: Metadata = {
  description: en.common.appDescription,
};

// Browser UI color: Neon's (the default theme) on the first paint, whatever the OS; once the app runs, applyTheme
// (src/store/effects.tsx, FR-011) rewrites both metas for the chosen theme ("System" → per-media light/dark color).
// viewportFit "cover" exposes the safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang / data-privacy are corrected before first paint by the inline script (stored prefs).
    <html
      lang="en"
      data-privacy="off"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={PREFERENCES_BOOT_SCRIPT} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
