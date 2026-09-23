import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CreditCard,
  Dumbbell,
  Palette,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PLATFORM_URL } from "@/lib/platform-brand";
import { faqSchema, jsonLdScript, softwareApplicationSchema } from "@/lib/structured-data";

const PAGE_URL = `${PLATFORM_URL}/gym-management-software`;

const TITLE = "Gym Management Software with a Branded Member App | Fit Foundry";
const DESCRIPTION =
  "Fit Foundry is gym management software that handles memberships, dues, attendance, workout programming and a white-label member app — in one place.";

const FAQS = [
  {
    question: "What does gym management software actually do?",
    answer:
      "It replaces the spreadsheets and WhatsApp groups most gyms run on. Fit Foundry keeps your member list, membership tiers and payments, marks attendance through QR check-in, stores every workout plan your trainers write, and gives members their own app to train from.",
  },
  {
    question: "Can members use it on their phone?",
    answer:
      "Yes. Members get an installable app that works on Android and iPhone, shows today's workout, logs every set, and keeps working offline — logs sync as soon as they are back online.",
  },
  {
    question: "Will it carry my gym's branding?",
    answer:
      "Fit Foundry is fully white-label. Your gym's name, logo and colours appear throughout the member app, and each gym gets its own web address.",
  },
  {
    question: "How does it help me collect dues?",
    answer:
      "Recording a payment moves the member's expiry date automatically. A dues list shows exactly who is overdue and by how much, with reminder notifications and a daily summary email to the owner.",
  },
  {
    question: "Do trainers have to write every plan by hand?",
    answer:
      "No. Trainers can enter a member's goals, injuries and available equipment, and the built-in AI drafts a full week of training using only the exercises in your library. The trainer edits and approves it before the member sees anything.",
  },
  {
    question: "Is my members' data kept separate from other gyms?",
    answer:
      "Every record is isolated per gym at the database level, so no gym can read another gym's members, plans or payments.",
  },
];

const FEATURES = [
  {
    icon: Smartphone,
    title: "Branded member app",
    body: "An installable mobile app under your gym's name — today's workout, set logging, progress charts and check-in.",
  },
  {
    icon: Dumbbell,
    title: "Plans and programming",
    body: "Build plans and reusable templates, assign them in seconds, and let AI draft a starting week for each member.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance and check-in",
    body: "QR check-in at the door, streaks for members, and attendance reports that show who has gone quiet.",
  },
  {
    icon: CreditCard,
    title: "Memberships, billing and dues",
    body: "Gold / Silver / Bronze style tiers, payment-driven expiry dates, and a dues list telling you exactly who to chase.",
  },
  {
    icon: BarChart3,
    title: "Owner reports",
    body: "Revenue, attendance and engagement in plain numbers, so you know how the gym is really doing this month.",
  },
  {
    icon: Palette,
    title: "White-label branding",
    body: "Your logo, colours and web address everywhere. Members never see someone else's brand.",
  },
];

export const Route = createFileRoute("/gym-management-software")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { rel: "canonical", href: PAGE_URL } as never,
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
    scripts: [
      jsonLdScript(softwareApplicationSchema({ url: PAGE_URL, description: DESCRIPTION })),
      jsonLdScript(faqSchema(FAQS)),
    ],
  }),
  component: GymManagementSoftwarePage,
});

function GymManagementSoftwarePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="glass-header">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Fit Foundry</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" className="rounded-xl">
                Sign in
              </Button>
            </Link>
            <Link to="/auth" className="hidden sm:block">
              <Button className="rounded-xl">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-16 pb-14 md:px-8 md:pt-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Built for independent gyms and studios
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight md:text-5xl lg:text-6xl">
            Gym management software that runs the{" "}
            <span className="text-primary">whole gym, not just the front desk.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            Fit Foundry brings memberships, dues, attendance, workout programming and a branded
            member app into one system. Your trainers stop juggling spreadsheets, your members get
            an app worth opening, and you finally see the numbers.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 rounded-xl px-6">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 rounded-xl px-6">
                Sign in
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No card needed to start · Your branding from day one
          </p>
        </div>
      </section>

      {/* Problem / solution */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-2 md:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Most gyms are run on three spreadsheets and a WhatsApp group
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground md:text-base">
              <li>• Renewal dates live in someone's head, so dues quietly slip.</li>
              <li>• Plans are written on paper and lost by the second week.</li>
              <li>• Nobody knows which members stopped showing up until they cancel.</li>
              <li>• Members have nothing from your gym on their phone.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              One system your whole gym actually uses
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground md:text-base">
              <li>• Payments set expiry dates, and a dues list tells you who to call today.</li>
              <li>• Every plan lives in the app, set by set, with progress history.</li>
              <li>• Attendance and engagement reports surface at-risk members early.</li>
              <li>• Members train from an app carrying your name and colours.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:px-8">
        <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Everything a gym needs to manage members
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Each piece works on its own, and they all share the same member record.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-8">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Up and running in an afternoon
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Set up your gym",
                body: "Add your name, logo and colours, then create your membership tiers and prices.",
              },
              {
                step: "2",
                title: "Add members and trainers",
                body: "Invite your team, import your member list, and record payments as they come in.",
              },
              {
                step: "3",
                title: "Start programming",
                body: "Build or AI-draft plans, assign them, and watch check-ins and progress roll in.",
              },
            ].map((s) => (
              <li key={s.step} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {s.step}
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16 md:px-8">
        <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Gym management software: common questions
        </h2>
        <Accordion type="single" collapsible className="mt-8">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.question} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center md:px-8">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Give your gym software your members will actually open
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start free, bring your branding, and move your members across at your own pace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 rounded-xl px-6">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" variant="outline" className="h-12 rounded-xl px-6">
                See the platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground md:px-8 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Fit Foundry. All rights reserved.</p>
          <nav className="flex flex-wrap gap-6">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
