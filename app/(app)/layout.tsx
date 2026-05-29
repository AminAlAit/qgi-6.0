import { Sidebar } from "@/components/nav/Sidebar";
import { PresentationWrapper } from "@/components/nav/PresentationWrapper";
import { TourProvider } from "@/components/tour/TourProvider";
import manifest from "@/data/te-sample-10/MANIFEST.json";

/**
 * V4.1 §2 — one canonical vintage stamp per session. Lives in the sidebar
 * (below the "Take the tour" button) so every page sees it once and only
 * once. Sourced server-side from the sample-10 MANIFEST so a new bake
 * lifts the chip automatically; passed as a prop to the (client) Sidebar
 * to keep the sidebar bundle from importing the heavy load.ts module.
 */
const dataVintage = (manifest as { produced_at_utc: string }).produced_at_utc;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PresentationWrapper>
      {/* T14 #307 HIGH fix (2026-04-19): overflow-x-hidden stops
          horizontal scroll bleed from the fixed-width sidebar at <768px
          until the full mobile hamburger redesign lands.
          T15 #308: skip-to-content anchor for keyboard/screen-reader users. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-[var(--qgi-accent)] focus:text-[var(--qgi-bg)] focus:rounded"
      >
        Skip to content
      </a>
      <div className="flex h-full overflow-x-hidden">
        <Sidebar dataVintage={dataVintage} />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          {children}
        </main>
      </div>
      {/* Tour-design 2026-05-18 — auto-fire on first visit (cookie-persisted),
          manual re-trigger from the sidebar "Take the tour" link. Content
          authored from 5-persona convergence. */}
      <TourProvider />
    </PresentationWrapper>
  );
}
