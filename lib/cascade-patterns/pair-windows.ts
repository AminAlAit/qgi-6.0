/**
 * pair-windows — lazy loader for data/pair-windows/{id}.json
 *
 * The pair-windows directory holds 215 files named by numeric country ID.
 * Each file is a Record<string, {top: WindowEntry[], hist: Record<string, number>}>.
 * The top key is the partner's numeric ID; the value is an array of best
 * sliding windows sorted by PPS descending.
 *
 * This loader is called at request time (Server Component) since the files
 * are large and we only need the relevant slice.
 *
 * 2026-05-30
 */

export interface WindowEntry {
  /** Window length in years */
  l: number;
  /** Start year for this country */
  sa: number;
  /** Start year for partner */
  sb: number;
  /** Index count */
  ic: number;
  /** Pearson correlation */
  ac: number;
  /** Pattern Power Score */
  pps: number;
}

export interface PairWindowRecord {
  /** Top windows sorted by PPS desc */
  top: WindowEntry[];
  /** Length histogram: length → count */
  hist: Record<string, number>;
}

/** Load the best windows for a given pair (country A + country B by numeric ID).
 *  Tries A→B first, then B→A. Returns null if neither file exists or the
 *  partner key isn't present.
 */
export async function loadPairWindows(
  idA: string,
  idB: string
): Promise<PairWindowRecord | null> {
  // Next.js static imports require compile-time known paths, so we use fs
  // dynamically. This file is always called from a Server Component.
  try {
    const fs = await import("fs/promises");
    const path = await import("path");

    const tryFile = async (
      fileId: string,
      partnerId: string
    ): Promise<PairWindowRecord | null> => {
      const filePath = path.join(process.cwd(), "data", "pair-windows", `${fileId}.json`);
      try {
        const raw = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(raw) as Record<string, PairWindowRecord>;
        return data[partnerId] ?? null;
      } catch {
        return null;
      }
    };

    return (await tryFile(idA, idB)) ?? (await tryFile(idB, idA));
  } catch {
    return null;
  }
}
