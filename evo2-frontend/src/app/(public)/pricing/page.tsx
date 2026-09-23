import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicHeading,
  ResearchNote,
  publicButton,
} from "~/components/public-page";
import { PLAN_LIMITS, formatAllowedGenomes } from "~/lib/plans";

export const metadata: Metadata = { title: "Access" };

export default function PricingPage() {
  const access = PLAN_LIMITS.researcher;

  return (
    <>
      <PublicHeading
        label="Free launch access"
        title="Use the complete research workspace after signing in."
      >
        Payments are currently disabled. Every authenticated account receives
        the existing Researcher feature set without entering payment details.
      </PublicHeading>

      <section className="border-phosphor/40 bg-phosphor/5 rounded-2xl border p-7 sm:p-9">
        <p className="text-phosphor text-xs font-semibold tracking-wide uppercase">
          Available now
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Researcher access</h2>
        <p className="mt-5 text-4xl font-semibold">Free</p>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
          Includes up to {access.dailyPredictions.toLocaleString()} daily
          predictions, {formatAllowedGenomes("researcher").toLowerCase()},
          prediction history, CSV export, and eligible disease-association
          exploration.
        </p>
        <Link href="/login" className={`${publicButton} mt-7`}>
          Sign in or create an account
        </Link>
      </section>

      <div className="text-muted-foreground mt-8 space-y-3 text-sm leading-relaxed">
        <p>
          Daily allowances reset at midnight UTC. Assembly and model support
          still determine which analyses can run.
        </p>
        <p>
          Billing pages remain available for transparency, but checkout and
          subscription management are disabled during this free launch.
        </p>
      </div>
      <ResearchNote />
    </>
  );
}
