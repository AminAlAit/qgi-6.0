/**
 * Blog-post Article schema (#433).
 *
 * Server-rendered <script type="application/ld+json"> enabling rich SERP
 * cards (title + date + author + image) for each QGI blog post. Inlined
 * per-post via the Next.js layout convention rather than wrapped in a
 * Provider; blog posts are static + short + benefit from deterministic
 * SSR output.
 */

interface ArticleJsonLdProps {
  headline: string;
  description: string;
  url: string;
  datePublished: string; // ISO 8601
  imageUrl?: string; // absolute URL; falls back to /og-default.png
}

export function ArticleJsonLd({
  headline,
  description,
  url,
  datePublished,
  imageUrl,
}: ArticleJsonLdProps) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url,
    datePublished,
    dateModified: datePublished,
    author: {
      "@type": "Person",
      name: "Amin Al-Ait",
      url: "https://qgintelligence.com/about",
    },
    publisher: {
      "@type": "Organization",
      name: "QGI Intelligence",
      url: "https://qgintelligence.com",
      logo: {
        "@type": "ImageObject",
        url: "https://qgintelligence.com/og-default.png",
      },
    },
    image: imageUrl ?? "https://qgintelligence.com/og-default.png",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
