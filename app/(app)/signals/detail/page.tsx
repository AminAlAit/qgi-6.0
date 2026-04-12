import { Suspense } from "react";
import { SignalDetailContent } from "@/components/signals/SignalDetailContent";

export default function SignalDetailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-full text-xs tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Loading signal...
        </div>
      }
    >
      <SignalDetailContent />
    </Suspense>
  );
}
