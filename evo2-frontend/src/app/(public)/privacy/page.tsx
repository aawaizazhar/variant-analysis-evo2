import type { Metadata } from "next";
import Link from "next/link";
import {
  DraftNotice,
  PublicHeading,
  PolicySection,
  publicTextLink,
} from "~/components/public-page";
import { publicSite } from "~/lib/public-site";

export const metadata: Metadata = { title: "Privacy — draft" };
export default function PrivacyPage() {
  return (
    <>
      <PublicHeading
        label="Privacy · draft"
        title="Understand what your analysis involves."
      >
        This draft describes the application&apos;s current data flows. Deployment
        locations, deletion procedures and backup retention still require
        confirmation.
      </PublicHeading>
      <DraftNotice />
      <PolicySection title="Who operates the service">
        <p>
          {publicSite.sellerName ?? "Operator identity pending confirmation."}{" "}
          is the proposed service operator. Send privacy questions using the{" "}
          <Link className={publicTextLink} href="/contact">
            contact details
          </Link>
          .
        </p>
      </PolicySection>
      <PolicySection title="Account and analysis data">
        <p>
          The application uses account identifiers, email, profile preferences
          and authentication sessions. Analysis requests include variant
          coordinates, assembly and sequence-related information. Saved results
          can include model outputs and interpretation evidence. Usage records
          enforce daily limits.
        </p>
        <p>
          Analysis data may be stored to provide history, caching, and usage
          controls. Account access is not a data-deletion setting.
        </p>
      </PolicySection>
      <PolicySection title="Processing and providers">
        <p>
          Supabase provides authentication and database storage, including
          profiles, saved history and model caches. Modal
          processes model-inference requests. Genome and annotation services
          provide reference information used during analysis. Hosting providers
          process requests and may retain operational logs; the production
          hosting and logging arrangements remain to be confirmed.
        </p>
        <p>
          Payments are currently disabled, so the application does not ask users
          to enter card details or send new checkout information to Paddle.
        </p>
      </PolicySection>
      <PolicySection title="Cookies and local storage">
        <p>
          Authentication uses session storage/cookies. The interface also stores
          preferences such as theme. A production inventory of cookies, logs and
          any analytics must be confirmed before this policy is published.
        </p>
      </PolicySection>
      <PolicySection title="Retention and deletion">
        <p>
          {publicSite.retentionPolicy ??
            "Retention periods await owner confirmation."}
        </p>
        <p>
          Closing or leaving an account does not automatically delete history.
          Deletion procedures and backup expiry are still being finalized. You
          may email privacy questions now, but this draft
          does not promise a deletion deadline or claim that a self-service
          deletion feature exists.
        </p>
      </PolicySection>
      <PolicySection title="Before publication">
        <p>
          Confirm applicable privacy obligations, processing purposes and legal
          bases, international transfers, provider arrangements, user rights and
          the operational deletion process. Do not submit identifiable patient
          data during this preparation stage.
        </p>
      </PolicySection>
    </>
  );
}
