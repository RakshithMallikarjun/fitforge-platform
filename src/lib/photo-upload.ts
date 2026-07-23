import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a member photo to the private bucket and return the storage OBJECT PATH.
 *
 * Store this path (not a signed URL) in the database. Consumers must mint a
 * short-lived signed URL on read via signPhotoValue.
 */
export async function uploadMemberPhoto(file: File, gymId: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const key = `${gymId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("member-photos").upload(key, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return key;
}

/** Sign a stored path for immediate client-side display (short-lived). */
export async function signMemberPhotoForDisplay(pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl) return null;
  let path = pathOrUrl;
  if (pathOrUrl.startsWith("http")) {
    const m = pathOrUrl.match(/\/member-photos\/([^?]+)/);
    if (!m) return pathOrUrl;
    path = decodeURIComponent(m[1]);
  }
  const { data } = await supabase.storage.from("member-photos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
