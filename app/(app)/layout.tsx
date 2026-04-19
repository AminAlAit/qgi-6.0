import { Sidebar } from "@/components/nav/Sidebar";
import { PresentationWrapper } from "@/components/nav/PresentationWrapper";

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
        <Sidebar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </PresentationWrapper>
  );
}
