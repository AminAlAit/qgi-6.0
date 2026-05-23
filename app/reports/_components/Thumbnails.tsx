import type { Report } from "../_data/reports-manifest";

const BG = "var(--qgi-bg)";
const ACCENT = "var(--qgi-accent)";
const TEXT = "var(--qgi-text)";
const MUTED = "var(--qgi-text-muted)";
const DIM = "var(--qgi-text-dim)";
const BORDER = "var(--qgi-border)";

function FrameShell({
  topLabel,
  children,
}: {
  topLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "16 / 9",
        backgroundColor: BG,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div
        className="absolute left-0 top-0 h-full"
        style={{ width: 3, backgroundColor: ACCENT }}
      />
      {topLabel && (
        <div
          className="absolute top-3 left-6 text-[10px] tracking-[0.2em] uppercase font-data"
          style={{ color: DIM }}
        >
          {topLabel}
        </div>
      )}
      <div className="absolute inset-0 flex items-center pl-8 pr-6">{children}</div>
    </div>
  );
}

function GhanaThumb() {
  return (
    <FrameShell topLabel="Ghana · Mauritania">
      <div className="flex items-baseline gap-4">
        <div
          className="font-data font-bold"
          style={{ fontSize: 64, color: ACCENT, lineHeight: 1 }}
        >
          99
          <span style={{ fontSize: 28, color: MUTED, marginLeft: 4 }}>th</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold" style={{ color: TEXT }}>
            Percentile, global election-stress
          </span>
          <span className="text-xs mt-1" style={{ color: MUTED }}>
            Mauritania mirror, 99% cosine
          </span>
        </div>
      </div>
    </FrameShell>
  );
}

function NigerBurkinaThumb() {
  return (
    <FrameShell topLabel="Niger · Burkina Faso">
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center">
          <span
            className="font-data font-bold leading-none"
            style={{ fontSize: 52, color: ACCENT }}
          >
            94
          </span>
          <span
            className="text-[10px] mt-1 tracking-wider uppercase"
            style={{ color: DIM }}
          >
            Niger
          </span>
        </div>
        <div className="font-data" style={{ fontSize: 22, color: MUTED }}>
          vs
        </div>
        <div className="flex flex-col items-center">
          <span
            className="font-data font-bold leading-none"
            style={{ fontSize: 52, color: TEXT }}
          >
            2
          </span>
          <span
            className="text-[10px] mt-1 tracking-wider uppercase"
            style={{ color: DIM }}
          >
            Burkina
          </span>
        </div>
        <div
          className="flex flex-col ml-3 pl-4"
          style={{ borderLeft: `1px solid ${BORDER}` }}
        >
          <span className="text-xs font-semibold" style={{ color: TEXT }}>
            Multilateral Agreement
          </span>
          <span className="text-[11px] mt-1" style={{ color: MUTED }}>
            95% cosine, opposite paths
          </span>
        </div>
      </div>
    </FrameShell>
  );
}

function IndiaPakistanThumb() {
  return (
    <FrameShell topLabel="India · Pakistan">
      <div className="flex items-baseline gap-4">
        <div
          className="font-data font-bold"
          style={{ fontSize: 64, color: ACCENT, lineHeight: 1 }}
        >
          99
          <span style={{ fontSize: 32, color: MUTED, marginLeft: 2 }}>%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold" style={{ color: TEXT }}>
            Cosine similarity
          </span>
          <span className="text-xs mt-1" style={{ color: MUTED }}>
            Civil War &amp; Insurgency, same fingerprint
          </span>
        </div>
      </div>
    </FrameShell>
  );
}

function UkraineBosniaThumb() {
  return (
    <FrameShell topLabel="Ukraine · Bosnia 1996">
      <div className="flex items-baseline gap-4">
        <div
          className="font-data font-bold"
          style={{ fontSize: 64, color: ACCENT, lineHeight: 1 }}
        >
          81
          <span style={{ fontSize: 32, color: MUTED, marginLeft: 2 }}>%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold" style={{ color: TEXT }}>
            Cosine, 16-point gap to next peer
          </span>
          <span className="text-xs mt-1" style={{ color: MUTED }}>
            Sovereign-credit thesis for UKRAIN 2027
          </span>
        </div>
      </div>
    </FrameShell>
  );
}

function FsiThumb() {
  return (
    <FrameShell topLabel="Fund for Peace · FSI">
      <div className="flex flex-col">
        <span
          className="font-data font-bold"
          style={{ fontSize: 36, color: ACCENT, lineHeight: 1.1 }}
        >
          FSI <span style={{ color: MUTED }}>x</span> QGI
        </span>
        <span className="text-xs mt-2" style={{ color: TEXT }}>
          Fragile-state pattern overlay
        </span>
        <span className="text-[11px] mt-1" style={{ color: MUTED }}>
          Where the indexes agree, where they diverge
        </span>
      </div>
    </FrameShell>
  );
}

function BurkinaFasoThumb() {
  return (
    <FrameShell topLabel="Burkina Faso">
      <div className="flex flex-col">
        <span
          className="font-data font-bold"
          style={{ fontSize: 30, color: TEXT, lineHeight: 1.15 }}
        >
          Mali 2010-2012
        </span>
        <span
          className="font-data font-bold"
          style={{ fontSize: 30, color: TEXT, lineHeight: 1.15 }}
        >
          CAR 2011-2013
        </span>
        <span className="text-xs mt-2" style={{ color: MUTED }}>
          Five risk domains aligned
        </span>
      </div>
    </FrameShell>
  );
}

function DefaultThumb({ category }: { category: string }) {
  return (
    <FrameShell>
      <div
        className="text-[11px] tracking-[0.25em] uppercase font-data"
        style={{ color: DIM }}
      >
        {category}
      </div>
    </FrameShell>
  );
}

export function ReportThumbnail({ report }: { report: Report }) {
  switch (report.slug) {
    case "ghana-mauritania-mirror":
      return <GhanaThumb />;
    case "niger-burkina-divergence":
      return <NigerBurkinaThumb />;
    case "india-pakistan-mirror":
      return <IndiaPakistanThumb />;
    case "ukraine-bosnia-mirror":
      return <UkraineBosniaThumb />;
    case "fsi-qgi-report":
      return <FsiThumb />;
    case "burkina-faso-mali-car-mirror":
      return <BurkinaFasoThumb />;
    default:
      return <DefaultThumb category={report.category} />;
  }
}
