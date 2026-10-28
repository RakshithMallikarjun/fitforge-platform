import { isHostingHost } from "@/lib/public-config";
import { CUSTOM_DOMAIN_A_RECORD, CUSTOM_DOMAIN_CNAME_TARGET } from "@/lib/platform-brand";

/** Branded CNAME target (env CUSTOM_DOMAIN_CNAME_TARGET overrides). */
export function cnameTarget() {
  const v = (process.env["CUSTOM_DOMAIN_CNAME_TARGET"] ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  // Never hand gyms an internal hosting host, even if misconfigured.
  return v && !isHostingHost(v) ? v : CUSTOM_DOMAIN_CNAME_TARGET;
}

export async function dohLookup(name: string, type: "CNAME" | "A"): Promise<string[]> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { Answer?: { type: number; data: string }[] };
  return (json.Answer ?? [])
    .filter((a) => (type === "CNAME" ? a.type === 5 : a.type === 1))
    .map((a) => a.data.replace(/\.$/, "").toLowerCase());
}

/** Follow the CNAME chain (max 8 hops); hit when any hop is the branded target. */
export async function lookupDomain(domain: string) {
  const target = cnameTarget();
  const chain: string[] = [];
  let cur = domain;
  let hit = false;
  for (let i = 0; i < 8; i++) {
    const next = (await dohLookup(cur, "CNAME"))[0];
    if (!next || chain.includes(next)) break;
    chain.push(next);
    if (next === target) {
      hit = true;
      break;
    }
    cur = next;
  }
  if (!hit && chain.length === 0) {
    const a = await dohLookup(domain, "A");
    hit = a.includes(CUSTOM_DOMAIN_A_RECORD);
  }
  return { active: hit, chain };
}

export async function checkDomainActive(domain: string): Promise<boolean> {
  return (await lookupDomain(domain)).active;
}
