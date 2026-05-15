import { Suspense } from "react";
import { CountrySignalProfileContent } from "@/components/signals-v1/CountrySignalProfileContent";

export default function CountrySignalProfilePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-full text-xs tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Loading country profile...
        </div>
      }
    >
      <CountrySignalProfileContent />
    </Suspense>
  );
}
