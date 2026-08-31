import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · FitForge" },
      {
        name: "description",
        content:
          "The terms covering use of FitForge by gyms, trainers and members, including health disclaimers and billing.",
      },
      { property: "og:title", content: "Terms of Service · FitForge" },
      {
        property: "og:description",
        content: "Terms covering gym, trainer and member use of FitForge.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 31 August 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="font-display text-lg font-semibold">Accounts</h2>
          <p className="mt-2">
            Member accounts are created by, and belong to, the gym that invited you. You are
            responsible for keeping your credentials secure and for the accuracy of the information
            you enter.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Health disclaimer</h2>
          <p className="mt-2">
            FitForge is a training and record-keeping tool, not medical advice. Workout plans,
            assessments and AI-generated load suggestions are guidance only. Consult a qualified
            professional before starting or changing a training programme, and stop if you feel
            unwell.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Acceptable use</h2>
          <p className="mt-2">
            Do not attempt to access another gym's or member's data, reverse-engineer the service,
            upload unlawful content, or use automated means to overload the platform.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Billing</h2>
          <p className="mt-2">
            Membership fees and billing cycles are set and collected by your gym. Records shown in
            the app reflect what your gym has entered.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold">Availability and liability</h2>
          <p className="mt-2">
            We work to keep the service available but cannot guarantee uninterrupted access. To the
            extent permitted by law, our liability is limited to the fees paid for the service.
          </p>
        </section>
      </div>

      <div className="mt-10 flex gap-4 text-sm">
        <Link to="/" className="font-medium text-primary underline">Back home</Link>
        <Link to="/privacy" className="font-medium text-primary underline">Privacy Policy</Link>
      </div>
    </main>
  );
}
