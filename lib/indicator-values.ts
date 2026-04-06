import { runQuery } from "@/lib/athena";

// Cache: `${indicatorId}::${country}` → Map<year, value>
const cache = new Map<string, Map<number, number>>();

/**
 * Fetch indicator time-series from the indicators Glue table via Athena.
 * The indicators table is Parquet-backed, partitioned by indicator_id.
 * Returns values for [startYear, startYear+1, ..., startYear+length-1].
 * Missing years get NaN.
 */
export async function getIndicatorValues(
  indicatorId: string,
  countryName: string,
  startYear: number,
  length: number
): Promise<number[]> {
  const cacheKey = `${indicatorId}::${countryName}`;

  try {
    let countryData = cache.get(cacheKey);

    if (!countryData) {
      const safe = countryName.replace(/'/g, "''");
      const rows = await runQuery(
        `SELECT year, value FROM qgi_data.indicators
         WHERE indicator_id = '${indicatorId}'
           AND country = '${safe}'
         ORDER BY year`
      );

      countryData = new Map<number, number>();
      for (const row of rows) {
        const y = parseInt(row.year, 10);
        const v = parseFloat(row.value);
        if (!isNaN(y) && !isNaN(v)) {
          countryData.set(y, v);
        }
      }
      cache.set(cacheKey, countryData);
    }

    const values: number[] = [];
    for (let y = startYear; y < startYear + length; y++) {
      values.push(countryData.get(y) ?? NaN);
    }
    return values;
  } catch {
    return [];
  }
}
