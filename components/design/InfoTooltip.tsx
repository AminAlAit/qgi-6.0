"use client";

import { useState, useRef, useEffect } from "react";

/**
 * (i) info tooltip — hover on desktop, tap on mobile.
 * Place next to any metric or term that needs explanation.
 *
 * Usage: <InfoTooltip text="Explanation here" />
 *
 * #567 fix (2026-05-02): the tooltip was being clipped by ancestor
 * `overflow-hidden` containers on `/precedents` (e.g. Section component).
 * Root cause: the tooltip declared `position: fixed` in className but
 * silently overrode with inline `position: absolute`, making it subject to
 * the nearest positioned ancestor's clipping. Real fix: use TRUE
 * `position: fixed` with coordinates computed from the trigger icon's
 * `getBoundingClientRect()`, which escapes every overflow-hidden ancestor.
 */
export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Recompute tooltip position whenever it opens (and on scroll/resize while open).
  // We intentionally DON'T reset `coords` to null on hide — the tooltip is
  // unmounted by the `{show && coords && ...}` guard below, and stale coords
  // get overwritten on next open. Avoiding setState-in-effect lint warning.
  useEffect(() => {
    if (!show || !triggerRef.current) return;
    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      // Place tooltip 8px above the icon, horizontally centered on it
      // (transform: translate(-50%, -100%) handles the centering + lift)
      setCoords({ top: r.top - 8, left: r.left + r.width / 2 });
    };
    update();
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, [show]);

  return (
    <span className="relative inline-block ml-1">
      {/* Use <span> not <button> to avoid nested-button hydration errors
          when InfoTooltip is placed inside a <button> (e.g. Ranking headers) */}
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
          e.stopPropagation();
          setShow(!show);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            setShow(!show);
          }
        }}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold transition-colors cursor-help"
        style={{
          backgroundColor: "var(--qgi-surface-2)",
          color: "var(--qgi-text-dim)",
          border: "1px solid var(--qgi-border)",
        }}
        aria-label="More info"
      >
        i
      </span>
      {show && coords && (
        <div
          role="tooltip"
          className="px-3 py-2 rounded-lg text-[11px] leading-relaxed w-64 max-w-[90vw] shadow-lg pointer-events-none"
          style={{
            // TRUE fixed positioning anchored to viewport — escapes every
            // ancestor's overflow-hidden / stacking-context clipping.
            position: "fixed",
            top: coords.top,
            left: coords.left,
            transform: "translate(-50%, -100%)",
            zIndex: 9999,
            backgroundColor: "var(--qgi-surface-2)",
            color: "var(--qgi-text)",
            border: "1px solid var(--qgi-border)",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
