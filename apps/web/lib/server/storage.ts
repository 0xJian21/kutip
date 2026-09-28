import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { UserError } from "@/lib/data/result";
import { checkLogo, LOGO_MAX_BYTES, LOGO_TYPES } from "./input";

/**
 * Company logos (IMPROVEMENTS R1) in a public Supabase Storage bucket. Only the server
 * uploads, with the service-role key; the browser only ever sees the public URL, which
 * lands in exporters.logo_url and is shown wherever Avatar takes `src`.
 */
export const LOGO_BUCKET = "logos";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new UserError("Logo uploads are not configured on this server");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let bucketReady: Promise<void> | undefined;
async function ensureBucket(sb: ReturnType<typeof client>): Promise<void> {
  bucketReady ??= (async () => {
    const { data } = await sb.storage.getBucket(LOGO_BUCKET);
    if (data) return;
    const { error } = await sb.storage.createBucket(LOGO_BUCKET, { public: true, fileSizeLimit: LOGO_MAX_BYTES, allowedMimeTypes: Object.keys(LOGO_TYPES) });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((e) => {
    bucketReady = undefined;
    throw e;
  });
  return bucketReady;
}

/** Uploads under <folder>/<sha256>.<ext> (content-addressed, so re-uploads are idempotent) and returns the public URL. The type comes from the bytes. */
export async function uploadLogo(folder: string, file: File): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(folder)) throw new Error(`bad logo folder ${folder}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const { ext, contentType } = checkLogo(bytes);
  const sb = client();
  await ensureBucket(sb);
  const path = `${folder}/${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.${ext}`;
  const { error } = await sb.storage.from(LOGO_BUCKET).upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`logo upload: ${error.message}`);
  return sb.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}
