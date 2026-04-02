import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import { createInterface } from "readline";

const REGION = "eu-central-1";
const BUCKET = "qgi-data-lake-111111111111";
const PREFIX = "pipeline-A-indicator-extractor/output/csv";

// Cache: indicatorId → Map<country, Map<year, value>>
const cache = new Map<string, Map<string, Map<number, number>>>();

function getS3Client(): S3Client {
  return new S3Client({ region: REGION });
}

/**
 * Fetch and parse an indicator CSV.GZ from S3.
 * Returns a map: country → year → value
 */
async function fetchIndicator(indicatorId: string): Promise<Map<string, Map<number, number>>> {
  if (cache.has(indicatorId)) return cache.get(indicatorId)!;

  const s3 = getS3Client();
  const key = `${PREFIX}/${indicatorId}/${indicatorId}.csv.gz`;

  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!resp.Body) throw new Error(`Empty body for ${key}`);

  const byteArray = await resp.Body.transformToByteArray();
  const buffer = Buffer.from(byteArray);

  // Decompress gzip
  const decompressed = await new Promise<string>((resolve, reject) => {
    const gunzip = createGunzip();
    const chunks: Buffer[] = [];
    gunzip.on("data", (chunk: Buffer) => chunks.push(chunk));
    gunzip.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    gunzip.on("error", reject);
    gunzip.end(buffer);
  });

  const result = new Map<string, Map<number, number>>();
  const lines = decompressed.split("\n");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // CSV: country,year,value
    const firstComma = line.indexOf(",");
    const lastComma = line.lastIndexOf(",");
    if (firstComma === -1 || lastComma === firstComma) continue;

    const country = line.substring(0, firstComma);
    const year = parseInt(line.substring(firstComma + 1, lastComma), 10);
    const value = parseFloat(line.substring(lastComma + 1));

    if (isNaN(year) || isNaN(value)) continue;

    if (!result.has(country)) result.set(country, new Map());
    result.get(country)!.set(year, value);
  }

  cache.set(indicatorId, result);
  return result;
}

/**
 * Get time-series values for a country over a year range.
 * Returns an array of values for [startYear, startYear+1, ..., startYear+length-1].
 * Missing years get null (filtered out client-side).
 */
export async function getIndicatorValues(
  indicatorId: string,
  countryName: string,
  startYear: number,
  length: number
): Promise<number[]> {
  try {
    const data = await fetchIndicator(indicatorId);
    const countryData = data.get(countryName);
    if (!countryData) return [];

    const values: number[] = [];
    for (let y = startYear; y < startYear + length; y++) {
      values.push(countryData.get(y) ?? NaN);
    }
    return values;
  } catch {
    return [];
  }
}
