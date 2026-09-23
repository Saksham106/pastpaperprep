import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getExamStyleTrigonometrySet } from "@/lib/exam-style-trigonometry";

const SIGNED_URL_TTL_SECONDS = 300;

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("R2 configuration is incomplete");
  if (!/^[a-f0-9]{32}$/i.test(accountId) || bucket !== "pastpaperprep-assets") throw new Error("R2 configuration is invalid");
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export async function signExamStyleTrigonometryPdf(slug: string) {
  const set = getExamStyleTrigonometrySet(slug);
  if (!set) return undefined;
  const { bucket, client } = getR2Client();
  const safeFilename = `${set.slug}.pdf`;
  const disposition = `inline; filename="${safeFilename}"`;
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: set.objectKey,
    ResponseContentType: "application/pdf",
    ResponseContentDisposition: disposition,
  }), { expiresIn: SIGNED_URL_TTL_SECONDS });
}

export { SIGNED_URL_TTL_SECONDS };
