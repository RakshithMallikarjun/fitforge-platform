import { supabase } from "@/integrations/supabase/client";
import { gymHostDecision, gymSiteUrl, gymSlugFromHost } from "@/lib/public-config";
import { useEffect, useState } from "react";

export function useGymHostSlug() {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => { setSlug(gymSlugFromHost(window.location.hostname)); }, []);
  return slug;
}

/** Reads the signed-in account's own gym under RLS; metadata never decides tenancy. */
export async function accountGymSlug(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("users").select("gym_id, gyms(slug)").eq("id", userId).maybeSingle();
  if (error) throw new Error("We couldn't check your gym address. Please try again.");
  return data?.gyms?.slug ?? null;
}

export async function enforceGymHost(userId: string): Promise<"stay" | "forward"> {
  const slug = await accountGymSlug(userId);
  const decision = gymHostDecision(window.location.hostname, slug);
  if (decision === "reject") {
    await supabase.auth.signOut();
    throw new Error("This account belongs to another gym. Please use your gym's sign-in address.");
  }
  if (decision === "forward" && slug) {
    // Sessions are origin-scoped. Never copy credentials into a URL or another origin's storage.
    await supabase.auth.signOut();
    window.location.replace(gymSiteUrl(slug, "/auth"));
    return "forward";
  }
  return "stay";
}