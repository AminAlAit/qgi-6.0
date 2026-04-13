import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qgintelligence.com"),
  title: "QGI — Quantitative Geopolitical Intelligence",
  description:
    "Discover quantitative patterns in how countries' trajectories mirror each other across time.",
  openGraph: {
    title: "QGI — Quantitative Geopolitical Intelligence",
    description:
      "Historical precedents in economic data across 214 countries and 58 indicators. Risk candidates that analysts should examine.",
    url: "https://qgintelligence.com",
    siteName: "QGI Intelligence",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
