import type { Metadata } from "next";
import Link from "next/link";
import { ProductPreview } from "~/components/product-preview";

export const metadata: Metadata = { title: "Product" };

export default function ProductPage() {
  return (
    <div className="product-page -mt-4 sm:-mt-8">
      <section className="grid items-center gap-12 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14 lg:py-14">
        <div className="product-enter product-enter-1 max-w-xl">
          <div className="border-phosphor/25 bg-phosphor/6 mb-6 inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5">
            <span className="bg-phosphor h-1.5 w-1.5 rounded-full" />
            <span className="text-phosphor font-mono text-[10px] tracking-[0.18em] uppercase">
              Genetic variant research
            </span>
          </div>
          <h1 className="text-foreground max-w-[12ch] text-4xl leading-[1.04] font-semibold tracking-[-0.045em] sm:text-5xl lg:text-[3.5rem]">
            Explore a variant. Keep the evidence in view.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-[58ch] text-base leading-relaxed sm:text-lg">
            Browse genes and variants, inspect Evo2 predictions, and explore
            disease-association hypotheses with their uncertainty made explicit.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/" className="product-primary-cta group">
              Explore the application
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </Link>
            <Link href="/pricing" className="product-secondary-link">
              View free access
            </Link>
          </div>

          <dl className="border-border/70 mt-10 grid grid-cols-3 border-y py-4">
            {[
              ["50", "daily analyses"],
              ["6 mo", "shared cache"],
              ["$0", "launch access"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="border-border/70 border-r px-3 first:pl-0 last:border-r-0 last:pr-0"
              >
                <dt className="text-foreground font-mono text-sm font-semibold sm:text-base">
                  {value}
                </dt>
                <dd className="text-muted-foreground mt-1 text-[10px] leading-tight sm:text-xs">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="product-enter product-enter-2 min-w-0 lg:-mr-8">
          <ProductPreview />
        </div>
      </section>

      <section className="product-section product-reveal border-border/70 border-t py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.68fr_1.32fr] lg:gap-16">
          <header className="lg:sticky lg:top-8 lg:self-start">
            <p className="product-kicker">One connected workflow</p>
            <h2 className="mt-4 max-w-sm text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
              Less context switching. More careful interpretation.
            </h2>
            <p className="text-muted-foreground mt-5 max-w-md text-sm leading-relaxed sm:text-base">
              DNAAnalyzer keeps the source variant, model result, and qualified
              evidence within one reviewable path.
            </p>
          </header>

          <ol className="divide-border/70 border-border/70 divide-y border-y">
            {[
              [
                "Choose a variant",
                "Select an available assembly and locate a gene or variant with its identifiers intact.",
                "Locate",
              ],
              [
                "Inspect the prediction",
                "Read the model output alongside available curated evidence and explicit uncertainty.",
                "Assess",
              ],
              [
                "Explore with context",
                "Use eligible disease rankings, analysis history, and CSV exports from one signed-in workspace.",
                "Review",
              ],
            ].map(([title, text, action], index) => (
              <li
                key={title}
                className="product-workflow-row group grid gap-4 py-7 sm:grid-cols-[3rem_0.7fr_1.3fr_auto] sm:items-start sm:gap-6"
              >
                <span className="text-phosphor font-mono text-xs">
                  0{index + 1}
                </span>
                <h3 className="text-base font-semibold tracking-tight sm:text-lg">
                  {title}
                </h3>
                <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
                  {text}
                </p>
                <span className="text-muted-foreground group-hover:text-phosphor font-mono text-[9px] tracking-widest uppercase transition-colors">
                  {action}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="interpretation"
        className="product-section product-reveal border-border/70 scroll-mt-8 border-t py-20 sm:py-24"
      >
        <header className="grid gap-5 sm:grid-cols-[0.85fr_1.15fr] sm:items-end">
          <div>
            <p className="product-kicker">Interpretation policy</p>
            <h2 className="mt-4 max-w-lg text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
              The prediction determines the next step.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed sm:justify-self-end sm:text-base">
            The interface changes its emphasis based on the result, while
            keeping computational output separate from clinical meaning.
          </p>
        </header>

        <div className="border-border/70 bg-border/70 mt-12 grid gap-px overflow-hidden rounded-2xl border lg:grid-cols-[1.15fr_0.85fr_1fr]">
          {[
            {
              code: "P/LP",
              title: "Pathogenic / Likely Pathogenic",
              text: "Eligible variants proceed to ML disease ranking for signed-in accounts. A high-ranked disease does not establish diagnosis or causality.",
              note: "Ranking eligible",
            },
            {
              code: "VUS",
              title: "VUS / Uncertain",
              text: "Disease ranking is skipped by default. Users may explicitly opt into hypotheses, without resolving the variant's uncertainty.",
              note: "Explicit opt-in",
            },
            {
              code: "B/LB",
              title: "Benign / Likely Benign",
              text: "Automatic ranking is skipped and curated evidence stays separate. A benign prediction does not rule out all clinical significance.",
              note: "Evidence separated",
            },
          ].map((item) => (
            <article
              key={item.code}
              className="product-interpretation-card group bg-card p-6 sm:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-phosphor font-mono text-[10px] tracking-widest uppercase">
                  {item.code}
                </span>
                <span className="bg-border group-hover:bg-phosphor/60 h-px w-8 transition-[width,background-color] duration-300 group-hover:w-12" />
              </div>
              <h3 className="mt-10 max-w-[18rem] text-lg font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                {item.text}
              </p>
              <p className="border-border/60 text-muted-foreground mt-8 border-t pt-4 font-mono text-[9px] tracking-widest uppercase">
                {item.note}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-reveal pt-2 pb-10">
        <div className="border-phosphor/25 bg-phosphor/5 relative overflow-hidden rounded-2xl border px-6 py-8 sm:px-9 sm:py-10">
          <div className="product-note-pattern" aria-hidden="true" />
          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="product-kicker">
                Research interpretation, with limits
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                Use the result to investigate, never to diagnose.
              </h2>
              <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
                Evo2 predictions are computational outputs, not clinical
                classifications. Disease rankings are research hypotheses, not
                diagnoses or disease-risk probabilities. They cannot establish
                causality, resolve a VUS, or guide treatment or reproductive
                decisions.
              </p>
            </div>
            <Link
              href="/login"
              className="product-primary-cta whitespace-nowrap"
            >
              Start researching
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
