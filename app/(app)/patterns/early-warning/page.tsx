export default function EarlyWarningPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
      <span className="text-4xl">⚡</span>
      <h1
        className="text-xs tracking-[0.2em] uppercase font-semibold"
        style={{ color: "var(--qgi-accent)" }}
      >
        Early Warning Signals
      </h1>
      <p
        className="text-xs tracking-wider text-center max-w-md leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        This view will surface patterns where a country is currently following
        another country&apos;s historical trajectory — the highest-value
        predictive insight QGI produces.
      </p>
      <div
        className="px-4 py-2 rounded border text-[10px] tracking-[0.15em] uppercase"
        style={{
          borderColor: "var(--qgi-border)",
          color: "var(--qgi-text-dim)",
        }}
      >
        Blocked by Recipes — Phase 6
      </div>
    </div>
  );
}
