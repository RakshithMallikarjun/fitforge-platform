/**
 * Photo URL signing helper.
 *
 * Storage buckets that hold member/progress photos are private. Historically
 * this app persisted a 10-year signed URL directly in the database, which is
 * effectively a permanent public link if it ever leaks.
 *
 * We now treat the stored value as the storage object PATH and mint a
 * short-lived signed URL on read. For backwards compatibility with rows that
 * still hold a full signed URL, we extract the path from the URL and re-sign
 * it fresh, which caps effective exposure at the short TTL below.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "member-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function extractPath(value: string): string | null {
  if (!value) return null;
  if (!value.startsWith("http")) return value.replace(/^\/+/, "");
  const m = value.match(/\/member-photos\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function signPhotoValue(
  supabase: SupabaseClient<any>,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  const path = extractPath(value);
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function signPhotoField<T extends Record<string, any>>(
  supabase: SupabaseClient<any>,
  rows: T[] | null | undefined,
  field: keyof T = "photo_url" as keyof T,
): Promise<T[]> {
  if (!rows || rows.length === 0) return [];
  return Promise.all(
    rows.map(async (r) => ({ ...r, [field]: await signPhotoValue(supabase, r[field] as any) })),
  );
}
