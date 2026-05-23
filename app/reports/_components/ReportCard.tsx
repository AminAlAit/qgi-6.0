import Link from "next/link";
import type { Route } from "next";
import type { Report } from "../_data/reports-manifest";
import { formatPublishedDate } from "../_data/reports-manifest";
import { ReportThumbnail } from "./Thumbnails";

type ReportCardProps = {
  report: Report;
  featured?: boolean;
};

function MetadataRow({ report }: { report: Report }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <span
        className="inline-flex items-center text-[10px] tracking-widest uppercase font-data px-2 py-1 rounded"
        style={{
          color: "var(--qgi-accent)",
          backgroundColor: "rgba(167, 139, 250, 0.08)",
          border: "1px solid rgba(167, 139, 250, 0.2)",
        }}
      >
        {report.category}
      </span>
      <span
        className="text-[10px] tracking-wider uppercase font-data"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {formatPublishedDate(report.publishedAt)}
      </span>
    </div>
  );
}

export function ReportCard({ report, featured = false }: ReportCardProps) {
  const isLive = report.status === "live";
  const isDisabled = report.status === "disabled";
  const titleSize = featured ? "text-xl" : "text-lg";

  const cardInner = (
    <article
      className="h-full flex flex-col rounded-lg border overflow-hidden transition-all duration-150 group"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <ReportThumbnail report={report} />
      <div className="flex flex-col flex-1 p-5">
        <MetadataRow report={report} />
        <h2
          className={`${titleSize} font-semibold leading-snug mb-2 transition-colors`}
          style={{ color: "var(--qgi-text)" }}
        >
          {report.title}
        </h2>
        <p
          className="text-sm leading-relaxed line-clamp-3"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {report.summary}
        </p>
        {isDisabled && (
          <span
            className="mt-3 inline-flex self-start text-[10px] tracking-widest uppercase font-data px-2 py-1 rounded"
            style={{
              color: "var(--qgi-text-dim)",
              backgroundColor: "rgba(255, 255, 255, 0.04)",
            }}
          >
            Coming Soon
          </span>
        )}
      </div>
    </article>
  );

  if (!isLive) {
    return (
      <div
        role="article"
        aria-label={`${report.title} (coming soon)`}
        className="block opacity-60 cursor-not-allowed h-full"
      >
        {cardInner}
      </div>
    );
  }

  const rawHref = report.href ?? `/reports/${report.slug}`;
  if (!rawHref.startsWith("/") && !rawHref.startsWith("https://")) {
    throw new Error(`Invalid report href: ${rawHref}`);
  }
  const href = rawHref as Route;

  return (
    <Link
      href={href}
      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--qgi-bg)] rounded-lg hover:[&_article]:border-[var(--qgi-accent)]"
    >
      {cardInner}
    </Link>
  );
}
