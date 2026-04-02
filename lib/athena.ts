import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  type Row,
} from "@aws-sdk/client-athena";

const REGION = "eu-central-1";
const WORKGROUP = process.env.ATHENA_WORKGROUP ?? "QGI-Lambda-Workgroup";
const OUTPUT_LOCATION = process.env.ATHENA_OUTPUT_LOCATION ?? "s3://qgi-data-lake-111111111111/query_results/";

// Cache: queryKey → { result, expiresAt }
const cache = new Map<string, { result: Record<string, string>[]; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

function getClient(): AthenaClient {
  return new AthenaClient({ region: REGION });
}

function rowsToObjects(rows: Row[]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].Data?.map((c) => c.VarCharValue ?? "") ?? [];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    row.Data?.forEach((cell, i) => {
      obj[headers[i]] = cell.VarCharValue ?? "";
    });
    return obj;
  });
}

async function poll(client: AthenaClient, queryExecutionId: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const { QueryExecution } = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
    );
    const state = QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") return;
    if (state === "FAILED" || state === "CANCELLED") {
      throw new Error(
        `Athena query ${state}: ${QueryExecution?.Status?.StateChangeReason ?? "unknown"}`
      );
    }
  }
  throw new Error("Athena query timed out after 60s");
}

export async function runQuery(
  sql: string,
  database: string = "qgi_data"
): Promise<Record<string, string>[]> {
  const cacheKey = `${database}::${sql}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.result;

  const client = getClient();
  const { QueryExecutionId } = await client.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: database },
      WorkGroup: WORKGROUP,
      ResultConfiguration: { OutputLocation: OUTPUT_LOCATION },
    })
  );
  if (!QueryExecutionId) throw new Error("No QueryExecutionId returned");

  await poll(client, QueryExecutionId);

  const allRows: Record<string, string>[] = [];
  let nextToken: string | undefined;
  do {
    const res = await client.send(
      new GetQueryResultsCommand({ QueryExecutionId, NextToken: nextToken })
    );
    const rows = res.ResultSet?.Rows ?? [];
    // First page includes header row; subsequent pages don't
    if (allRows.length === 0) {
      allRows.push(...rowsToObjects(rows));
    } else {
      // Prepend a fake header row so rowsToObjects works
      const firstPageHeaders = res.ResultSet?.ResultSetMetadata?.ColumnInfo?.map(
        (c) => ({ VarCharValue: c.Name })
      ) ?? [];
      allRows.push(...rowsToObjects([{ Data: firstPageHeaders }, ...rows]));
    }
    nextToken = res.NextToken;
  } while (nextToken);

  cache.set(cacheKey, { result: allRows, expiresAt: now + CACHE_TTL_MS });
  return allRows;
}
