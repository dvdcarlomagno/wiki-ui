import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

const siteDescription =
  "Open-source UI for the LLM Wiki pattern — query and ingest a markdown knowledge base with OpenRouter and Cursor agents.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "wiki-ui",
    template: "%s · wiki-ui",
  },
  description: siteDescription,
  applicationName: "wiki-ui",
  keywords: [
    "wiki-ui",
    "LLM wiki",
    "knowledge base",
    "OpenRouter",
    "Cursor agents",
    "markdown wiki",
    "open source",
  ],
  authors: [{ name: "Davide Carlomagno" }],
  creator: "Davide Carlomagno",
  publisher: "wiki-ui",
  category: "productivity",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "wiki-ui",
    title: "wiki-ui",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "wiki-ui",
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
