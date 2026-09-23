import Link from "next/link";
import { publicSite } from "~/lib/public-site";

export const publicButton =
  "inline-flex items-center justify-center rounded-lg bg-phosphor px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-phosphor/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-phosphor";
export const publicTextLink =
  "rounded-sm text-phosphor underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-phosphor";

export function PublicHeading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="max-w-3xl pb-10 sm:pb-14">
      <p className="text-phosphor mb-4 font-mono text-xs tracking-widest uppercase">
        {label}
      </p>
      <h1 className="text-foreground text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        {title}
      </h1>
      <div className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
        {children}
      </div>
    </header>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border border-t py-7 sm:grid sm:grid-cols-[1fr_2fr] sm:gap-10">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground space-y-4 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function DraftNotice() {
  if (publicSite.policiesApproved) return null;
  return (
    <aside className="border-border bg-muted/40 mb-10 rounded-xl border p-5 text-sm leading-relaxed">
      <p className="font-semibold">Draft for owner review</p>
      <p className="text-muted-foreground mt-1">
        Seller details and policy commitments are not finalized. This draft is
        not a published agreement or a refund or retention promise.
      </p>
    </aside>
  );
}

export function ResearchNote() {
  return (
    <aside className="border-phosphor/30 bg-phosphor/5 mt-12 border-l-2 p-6">
      <h2 className="font-semibold">Research interpretation, with limits</h2>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
        Evo2 predictions are computational outputs, not clinical
        classifications. Disease rankings are research hypotheses, not diagnoses
        or disease-risk probabilities. They cannot establish causality, resolve
        a VUS, or guide treatment or reproductive decisions.
      </p>
      <Link
        className={`${publicTextLink} mt-3 inline-block text-sm`}
        href="/product#interpretation"
      >
        How results are handled
      </Link>
    </aside>
  );
}
