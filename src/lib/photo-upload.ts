import { supabase } from "@/integrations/supabase/client";

export async function uploadMemberPhoto(file: File, gymId: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const key = `${gymId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("member-photos").upload(key, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  // Bucket is private; use signed URL valid for ~10 years for display.
  const { data, error: sErr } = await supabase.storage
    .from("member-photos")
    .createSignedUrl(key, 60 * 60 * 24 * 365 * 10);
  if (sErr || !data?.signedUrl) throw sErr ?? new Error("Could not sign URL");
  return data.signedUrl;
}
