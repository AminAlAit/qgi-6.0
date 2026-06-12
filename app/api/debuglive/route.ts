// TEMPORARY diagnostic route (live-pulse OIDC debug 2026-06-12). Returns only
// non-sensitive diagnostics (region value, role-arn presence + tail, the exact
// S3 error) — never the secret keys. REMOVE after diagnosis.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const roleArn = process.env.AWS_ROLE_ARN;
  const out: Record<string, unknown> = {
    AWS_REGION_env: process.env.AWS_REGION ?? null,
    role_arn_present: Boolean(roleArn),
    role_arn_tail: (roleArn ?? "").slice(-40),
    region_used_by_loader: process.env.AWS_REGION ?? "eu-central-1",
    vercel_oidc_token_present: Boolean(process.env.VERCEL_OIDC_TOKEN),
  };
  try {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const credentials = roleArn
      ? (await import("@vercel/oidc-aws-credentials-provider")).awsCredentialsProvider({
          roleArn,
        })
      : undefined;
    const s3 = new S3Client({
      region: process.env.AWS_REGION ?? "eu-central-1",
      ...(credentials ? { credentials } : {}),
    });
    const resp = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.QGI_DATA_LAKE_BUCKET ?? "qgi-data-lake-222222222222",
        Key: "dashboard/hf-pulse-live.json",
      })
    );
    const body = await resp.Body?.transformToString();
    out.read_ok = true;
    out.bytes = body?.length ?? 0;
    try {
      out.file_status = (JSON.parse(body ?? "{}") as { status?: string }).status;
    } catch {
      out.file_status = "<unparseable>";
    }
  } catch (e) {
    const err = e as { name?: string; message?: string; Code?: string; $metadata?: unknown };
    out.read_ok = false;
    out.error_name = err?.name ?? null;
    out.error_code = err?.Code ?? null;
    out.error_message = String(err?.message ?? e).slice(0, 400);
  }
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
