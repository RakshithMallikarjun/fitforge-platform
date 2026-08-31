import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · FitForge" },
      {
        name: "description",
        content:
          "How FitForge collects, stores and protects member health metrics, progress photos and payment records.",
      },
      { property: "og:title", content: "Privacy Policy · FitForge" },
      {
        property: "og:description",
        content: "How FitForge handles member health data, progress photos and payment records.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 31 August 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-display text-lg font-semibold">What we collect</h2>
          <p className="mt-2">
            Account details (name, email, phone), membership and payment records, workout and
            attendance history, body metrics from fitness assessments, and any progress photos you
            choose to upload.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Why we collect it</h2>
          <p className="mt-2">
            To deliver your training programme, show your progress, let your gym manage your
            membership, and let your assigned trainer coach you. We do not sell personal data and we
            do not use your health data for advertising.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Who can see it</h2>
          <p className="mt-2">
            Only you, the administrators of your gym, and trainers assigned to you. Data is isolated
            per gym at the database level; members of one gym can never read another gym's records.
            Progress photos are stored in private storage and served through short-lived signed
            links.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Retention and your rights</h2>
          <p className="mt-2">
            You can request a copy of your data, correction of inaccuracies, or deletion of your
            account and photos at any time by contacting your gym or writing to us. Deactivated
            accounts stop being processed for training purposes immediately.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Security</h2>
          <p className="mt-2">
            Data is encrypted in transit and at rest, access is authenticated per user, and
            row-level security policies enforce tenant isolation on every request.
          </p>
        </section>
      </div>

      <div className="mt-10 flex gap-4 text-sm">
        <Link to="/" className="font-medium text-primary underline">Back home</Link>
        <Link to="/terms" className="font-medium text-primary underline">Terms of Service</Link>
      </div>
    </main>
  );
}
