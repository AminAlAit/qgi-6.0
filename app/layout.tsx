import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
 * - `alternates.canonical` prevents duplicate-content dilution between
 *   qgintelligence.com and qgi-frontend.vercel.app.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://qgintelligence.com"),
  title: "QGI — Quantitative Geopolitical Intelligence",
  description:
    "Historical precedents in economic data across 197 countries and 58 indicators. Risk candidates that analysts should examine.",
  alternates: { canonical: "https://qgintelligence.com" },
  openGraph: {
    title: "QGI — Quantitative Geopolitical Intelligence",
    description:
      "Historical precedents in economic data across 197 countries and 58 indicators. Risk candidates that analysts should examine.",
    url: "https://qgintelligence.com",
    siteName: "QGI Intelligence",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "QGI Intelligence — Quantitative Geopolitical Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QGI — Quantitative Geopolitical Intelligence",
    description:
      "Historical precedents in economic data across 197 countries.",
    images: ["/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// T19 #312: Organization schema helps Google understand QGI as an entity
// and enables knowledge-panel treatment. Injected as a <script> tag in
// the body so it's available site-wide.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "QGI Intelligence",
  alternateName: "Quantitative Geopolitical Intelligence",
  url: "https://qgintelligence.com",
  description:
    "QGI finds historical economic precedents at scale across 197 countries. Risk candidates that analysts should examine, not probability forecasts.",
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
