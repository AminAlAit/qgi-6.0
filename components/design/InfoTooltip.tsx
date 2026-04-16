"use client";

import { useState } from "react";

/**
 * (i) info tooltip — hover on desktop, tap on mobile.
 * Place next to any metric or term that needs explanation.
 *
 * Usage: <InfoTooltip text="Explanation here" />
 */
export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-block ml-1">
      {/* Use <span> not <button> to avoid nested-button hydration errors
          when InfoTooltip is placed inside a <button> (e.g. Ranking headers) */}
      <span
        role="button"
        tabIndex={0}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setShow(!show); } }}
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
      {show && (
        <div
          className="fixed z-[9999] px-3 py-2 rounded-lg text-[11px] leading-relaxed w-64 max-w-[90vw] shadow-lg pointer-events-none"
          style={{
            backgroundColor: "var(--qgi-surface-2)",
            color: "var(--qgi-text)",
            border: "1px solid var(--qgi-border)",
            // Position near the button using a ref-free approach:
            // we rely on the parent's relative positioning but render
            // with `fixed` and transform to stay in viewport.
            top: "auto",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            position: "absolute",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
