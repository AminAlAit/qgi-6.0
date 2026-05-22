import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CANONICAL_SCOPE_SENTENCE, TOTAL_COUNTRIES } from "@/lib/site-stats";

// T16 #309 LOW fix: declare `display: "swap"` so text is visible during
// webfont download instead of the default "block" FOIT period.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Root metadata (T19 #312).
 *
 * - `openGraph.images` + `twitter` added so social previews don't render
 *   blank. PNG lives at `public/og-default.png` (1200×630). Per-page
 *   routes override with more specific art when available.
 * - `robots` default-allowed. Per-route opt-outs happen in their own
 *   metadata.
 * - **NO `alternates.canonical` at root** — #699 regression fix (2026-05-15):
 *   the root canonical inherited to every child page that didn't explicitly
 *   override, so V3 routes (`/precedents`, `/countries`, etc.) all told
 *   Google "I am a duplicate of https://qgintelligence.com" — the exact
 *   bug PR-iii's V3 cutover was supposed to fix. Each route now declares
 *   its own canonical in its own metadata; the home page (`app/page.tsx`)
 *   declares `canonical: "/"` explicitly.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://qgintelligence.com"),
  title: "QGI · Quantitative Geopolitical Intelligence",
  description: `${CANONICAL_SCOPE_SENTENCE} Risk candidates that analysts should examine.`,
  openGraph: {
    title: "QGI · Quantitative Geopolitical Intelligence",
    description: `${CANONICAL_SCOPE_SENTENCE} Risk candidates that analysts should examine.`,
    url: "https://qgintelligence.com",
    siteName: "QG Intelligence",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "QG Intelligence · Quantitative Geopolitical Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QGI · Quantitative Geopolitical Intelligence",
    description: `Historical precedents in economic data across ${TOTAL_COUNTRIES} countries.`,
    images: ["/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  // #433: apple-touch-icon + PWA manifest so iOS home-screen save uses
  // a real QGI-branded icon instead of a low-res auto-crop of the page.
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

// T19 #312: Organization schema helps Google understand QGI as an entity
// and enables knowledge-panel treatment. Injected as a <script> tag in
// the body so it's available site-wide.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "QG Intelligence",
  alternateName: "Quantitative Geopolitical Intelligence",
  url: "https://qgintelligence.com",
  description: `QGI finds historical economic precedents at scale across ${TOTAL_COUNTRIES} countries. Risk candidates that analysts should examine, not probability forecasts.`,
  founder: { "@type": "Person", name: "Amin Al-Ait" },
  sameAs: ["https://www.linkedin.com/in/aminalait/"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
