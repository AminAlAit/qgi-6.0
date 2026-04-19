/**
 * robots.txt route (T19 #312).
 *
 * Allows search engines to crawl public content. Disallows the login page
 * (not useful to index) and API endpoints (protected + cost-sensitive).
 */
import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://qgintelligence.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/login", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
