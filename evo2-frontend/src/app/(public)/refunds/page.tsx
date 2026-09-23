import type { Metadata } from "next";
import Link from "next/link";
import {
  DraftNotice,
  PublicHeading,
  PolicySection,
  publicTextLink,
} from "~/components/public-page";
import { publicSite } from "~/lib/public-site";

export const metadata: Metadata = { title: "Refunds — draft" };
export default function RefundsPage() {
  return (
    <>
      <PublicHeading
        label="Refunds · draft"
        title="Payments are currently disabled."
      >
        DNAAnalyzer does not currently accept payments, so there are no charges
        to refund during the free launch.
      </PublicHeading>
      <DraftNotice />
      <PolicySection title="Refund eligibility">
        <p>
          {publicSite.refundPolicy ??
            "The owner has not selected eligibility rules, a request deadline, exclusions or an access policy following refunds. These must be finalized before real subscriptions are offered."}
        </p>
      </PolicySection>
      <PolicySection title="Subscriptions">
        <p>
          Subscription checkout and subscription management are disabled. Every
          authenticated account currently receives free application access.
        </p>
        <p>
          Account access and deletion of saved analysis history are separate
          processes.
        </p>
      </PolicySection>
      <PolicySection title="Current refund handling">
        <p>
          There is no active refund workflow because the application does not
          accept payments. A final refund policy must be published before paid
          access is enabled.
        </p>
      </PolicySection>
      <PolicySection title="Billing questions">
        <p>
          Use the{" "}
          <Link className={publicTextLink} href="/contact">
            support contact
          </Link>{" "}
          for account or access questions. Do not send card or bank details.
        </p>
      </PolicySection>
    </>
  );
}
