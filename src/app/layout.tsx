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

// Browser UI color follows the OS theme by default; a manual theme choice rewrites both metas
// (applyTheme in src/store/effects.tsx, FR-011). viewportFit "cover" exposes the safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#031F1D" },
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
