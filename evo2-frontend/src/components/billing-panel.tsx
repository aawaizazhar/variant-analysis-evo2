import { CheckCircle2, CreditCard } from "lucide-react";

/**
 * Billing is deliberately informational during the free launch. Keeping this
 * component preserves the existing billing/settings page without initiating
 * checkout, loading Paddle, or calling a billing API.
 */
export function BillingPanel({ confirming = false }: { confirming?: boolean }) {
  return (
    <section
      className="border-border/60 bg-card rounded-xl border p-5 sm:p-7"
      aria-label="Billing availability"
    >
      <div className="flex items-start gap-4">
        <div className="bg-phosphor/10 rounded-full p-3">
          <CreditCard className="text-phosphor h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Payments are currently disabled
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            No card or payment details are required. Every signed-in user has
            free access to the research workspace while billing is paused.
          </p>
          <p className="text-phosphor mt-4 flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Your account can use the application now.
          </p>
          {confirming ? (
            <p className="text-muted-foreground mt-3 text-sm">
              No subscription confirmation is necessary.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
