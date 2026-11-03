import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InlineScript } from "@/components/layout/InlineScript";
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
  description:
    "Zero-cost personal finance tracker with automatic income splitting and a semi-monthly Safe-to-Spend.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
