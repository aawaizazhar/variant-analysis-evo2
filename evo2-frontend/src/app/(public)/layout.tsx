import type { Metadata } from "next";
import Link from "next/link";
import { publicLinks, publicSite } from "~/lib/public-site";

export const metadata: Metadata = {
  title: {
    default: "DNAAnalyzer | Variant research",
    template: "%s | DNAAnalyzer",
  },
  description:
    "Explore genetic variants with Evo2 predictions and clearly qualified research evidence.",
  robots: { index: false, follow: false },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navStyle =
    "rounded-sm text-sm text-muted-foreground transition-colors hover:text-phosphor focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-phosphor";
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a
        href="#public-content"
        className="bg-background sr-only z-50 rounded p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-6 sm:px-8">
          <Link
            href="/product"
            className="focus-visible:outline-phosphor rounded-sm text-lg font-semibold tracking-tight focus-visible:outline-2"
          >
            {publicSite.name}
            <span className="text-phosphor ml-2 font-mono text-xs font-normal">
              / research
            </span>
          </Link>
          <nav
            aria-label="Public navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            {publicLinks.slice(0, 3).map((link) => (
              <Link key={link.href} href={link.href} className={navStyle}>
                {link.label}
              </Link>
            ))}
            <Link href="/" className={`${navStyle} text-foreground`}>
              Open application
            </Link>
          </nav>
        </div>
      </header>
      <main
        id="public-content"
        className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-20"
      >
        {children}
      </main>
      <footer className="border-border border-t">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8">
          <div>
            <p className="text-sm font-medium">{publicSite.name}</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Educational and research use. No clinical validation claimed.
            </p>
            {!publicSite.policiesApproved && (
              <p className="text-muted-foreground mt-2 text-xs">
                Pre-launch preview. Policies awaiting owner review.
              </p>
            )}
          </div>
          <nav
            aria-label="Product and policies"
            className="flex flex-wrap content-start gap-x-5 gap-y-3 sm:justify-end"
          >
            {publicLinks.map((link) => (
              <Link key={link.href} href={link.href} className={navStyle}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
