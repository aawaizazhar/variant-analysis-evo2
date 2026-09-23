import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicHeading,
  PolicySection,
  ResearchNote,
  publicButton,
  publicTextLink,
} from "~/components/public-page";

export const metadata: Metadata = { title: "Product" };

export default function ProductPage() {
  return (
    <>
      <div className="grid items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <PublicHeading
            label="Genetic variant research"
            title="Explore a variant. Keep the evidence in view."
          >
            Browse genes and variants, inspect Evo2 predictions, and explore
            disease-association hypotheses with their uncertainty made explicit.
          </PublicHeading>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/" className={publicButton}>
              Explore the application
            </Link>
            <Link href="/pricing" className={publicTextLink}>
              View access
            </Link>
          </div>
        </div>
        <aside className="border-border bg-card rounded-2xl border p-7 sm:p-9">
          <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
            The research workflow
          </p>
          <ol className="mt-6 space-y-6">
            {[
              [
                "Choose a variant",
                "Select an available assembly and locate a gene or variant.",
              ],
              [
                "Inspect the prediction",
                "Read the model output alongside available curated evidence.",
              ],
              [
                "Explore with context",
                "Signed-in users can access eligible disease rankings, history and CSV exports.",
              ],
            ].map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="text-phosphor font-mono text-sm">
                  0{i + 1}
                </span>
                <div>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <section id="interpretation" className="mt-20 scroll-mt-8">
        <h2 className="mb-8 text-2xl font-semibold tracking-tight">
          The prediction determines the next step.
        </h2>
        <PolicySection title="Pathogenic / Likely Pathogenic">
          <p>
            For signed-in accounts, eligible variants proceed to ML disease
            ranking. A computational prediction and a high-ranked disease do not
            establish a clinical diagnosis or a causal relationship.
          </p>
        </PolicySection>
        <PolicySection title="VUS / Uncertain">
          <p>
            Disease ranking is skipped by default. Signed-in users may
            explicitly opt into exploratory hypotheses. Exploring a VUS does not
            resolve its uncertain significance.
          </p>
        </PolicySection>
        <PolicySection title="Benign / Likely Benign">
          <p>
            Automatic ML disease ranking is skipped. Available curated evidence
            is shown separately. A benign model prediction does not rule out all
            clinical significance.
          </p>
        </PolicySection>
      </section>
      <ResearchNote />
    </>
  );
}
