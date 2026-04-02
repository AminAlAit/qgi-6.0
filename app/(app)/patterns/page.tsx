import { Suspense } from "react";
import PatternsClient from "./PatternsClient";

export default function PatternsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-full text-xs tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          LOADING…
        </div>
      }
    >
      <PatternsClient />
    </Suspense>
  );
}
