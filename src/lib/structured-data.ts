/**
 * JSON-LD structured data for the public marketing pages.
 *
 * Each helper returns a plain object that is stringified into a
 * `application/ld+json` script through a route's `head()` `scripts` option.
 */
import { PLATFORM_NAME, PLATFORM_URL, SUPPORT_EMAIL } from "@/lib/platform-brand";

const ORGANIZATION_ID = `${PLATFORM_URL}/#organization`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: PLATFORM_NAME,
    url: PLATFORM_URL,
    logo: `${PLATFORM_URL}/icons/icon-512.png`,
    description:
      "Gym management software with a white-label member app, trainer programming tools, attendance and billing for modern gyms.",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        availableLanguage: ["English"],
      },
    ],
  };
}

export function softwareApplicationSchema(opts?: { url?: string; description?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PLATFORM_NAME,
    url: opts?.url ?? PLATFORM_URL,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Gym management software",
    operatingSystem: "Web, iOS, Android",
    description:
      opts?.description ??
      "Gym management software that runs your memberships, dues, attendance, workout programming and a branded member app from one place.",
    publisher: { "@id": ORGANIZATION_ID },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      description: "Free trial, then per-gym subscription.",
    },
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

/** Wraps a schema object in the `scripts` entry TanStack `head()` expects. */
export function jsonLdScript(schema: unknown) {
  return { type: "application/ld+json", children: JSON.stringify(schema) };
}
