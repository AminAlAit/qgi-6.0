"use client";

/**
 * Cross-platform country flag using SVG icons from country-flag-icons.
 * Replaces emoji flags which don't render on Windows.
 *
 * Usage: <CountryFlag alpha2="US" size={24} />
 */
import { hasFlag } from "country-flag-icons";
import * as Flags3x2 from "country-flag-icons/react/3x2";

interface Props {
  alpha2: string;
  size?: number;
  className?: string;
}

export function CountryFlag({ alpha2, size = 24, className }: Props) {
  const code = alpha2?.toUpperCase();

  if (!code || !hasFlag(code)) {
    // Fallback: show alpha-2 code in a badge
    return (
      <span
        className={`inline-flex items-center justify-center font-data text-[9px] font-bold rounded ${className ?? ""}`}
        style={{
          width: size * 1.5,
          height: size,
          backgroundColor: "var(--qgi-surface-2)",
          color: "var(--qgi-text-muted)",
        }}
      >
        {code || "??"}
      </span>
    );
  }

  const FlagComponent = (Flags3x2 as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[code];

  if (!FlagComponent) {
    return (
      <span
        className={`inline-flex items-center justify-center font-data text-[9px] font-bold rounded ${className ?? ""}`}
        style={{
          width: size * 1.5,
          height: size,
          backgroundColor: "var(--qgi-surface-2)",
          color: "var(--qgi-text-muted)",
        }}
      >
        {code}
      </span>
    );
  }

  return (
    <FlagComponent
      className={className}
      style={{
        width: size * 1.5,
        height: size,
        borderRadius: 2,
      }}
    />
  );
}
