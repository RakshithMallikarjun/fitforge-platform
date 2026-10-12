/** Each protected content route owns its title and sharing metadata. */
export function consolePageHead(name: string, description: string) {
  const title = `${name} · Fit Foundry`;
  return { meta: [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] };
}