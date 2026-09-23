import type { Metadata } from "next";
import Link from "next/link";
import {
  DraftNotice,
  PublicHeading,
  PolicySection,
  publicTextLink,
} from "~/components/public-page";
import { publicSite } from "~/lib/public-site";

export const metadata: Metadata = { title: "Terms — draft" };
export default function TermsPage() {
  return (
    <>
      <PublicHeading
        label="Terms · draft"
        title="Scope, access and responsibilities."
      >
        A review draft describing the current application. Effective date and
        final contractual terms remain unset.
      </PublicHeading>
      <DraftNotice />
      <PolicySection title="Service operator">
        <p>
          {publicSite.sellerName ?? "Seller name pending confirmation."}{" "}
          operates DNAAnalyzer. Contact details are on the{" "}
          <Link href="/contact" className={publicTextLink}>
            contact page
          </Link>
          . The production domain has not been finalized.
        </p>
      </PolicySection>
      <PolicySection title="Intended use">
        <p>
          The application supports education and research on genetic variants.
          Predictions are not clinical classifications, diagnoses, treatment
          recommendations or validated measures of personal disease risk. Do not
          use them to make medical or reproductive decisions.
        </p>
      </PolicySection>
      <PolicySection title="Accounts and submissions">
        <p>
          Use an account you control and protect your sign-in credentials.
          Submit only information you are authorized to process. Avoid
          identifiable patient information. Model and reference-data limitations
          may prevent an analysis from completing.
        </p>
      </PolicySection>
      <PolicySection title="Application access">
        <p>
          The{" "}
          <Link href="/pricing" className={publicTextLink}>
            access page
          </Link>{" "}
          describes current limits. During the free launch, every authenticated
          user receives the Researcher feature set. Access does not change the
          scientific confidence of a result.
        </p>
      </PolicySection>
      <PolicySection title="Billing">
        <p>
          Checkout and subscription management are currently disabled. The
          service does not require card details or charge users during this free
          launch. Billing terms must be updated before paid access is offered.
        </p>
        <p>
          Refund terms are not currently applicable because no payments are
          accepted. See the{" "}
          <Link href="/refunds" className={publicTextLink}>
            refund draft
          </Link>
          . Account deletion and saved-history deletion are separate processes.
        </p>
      </PolicySection>
      <PolicySection title="Before publication">
        <p>
          The owner must review final terms, including applicable jurisdiction,
          eligibility, permitted use, intellectual property, liability, service
          changes and termination. This draft does not invent those commitments.
        </p>
      </PolicySection>
    </>
  );
}
