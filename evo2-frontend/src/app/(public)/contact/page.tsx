import type { Metadata } from "next";
import {
  PublicHeading,
  PolicySection,
  publicTextLink,
} from "~/components/public-page";
import { publicSite } from "~/lib/public-site";

export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() {
  return (
    <>
      <PublicHeading
        label="Contact"
        title="A direct line for product questions."
      >
        Ask about the application, report a problem, or raise an account or
        privacy question.
      </PublicHeading>
      <PolicySection title="Support">
        <p>
          {publicSite.supportEmail ? (
            <a
              className={`${publicTextLink} break-all`}
              href={`mailto:${publicSite.supportEmail}`}
            >
              {publicSite.supportEmail}
            </a>
          ) : (
            "Support address awaiting owner confirmation."
          )}
        </p>
        <p>
          Include the page you were using and a short description of the issue.
        </p>
        <p>
          Do not email card details, passwords, API keys, patient identifiers or
          genetic files. No response-time commitment has been set.
        </p>
      </PolicySection>
      <PolicySection title="Seller">
        <p>
          {publicSite.sellerName ??
            "Seller identity awaiting owner confirmation."}
        </p>
        <p>Production domain: {publicSite.domain ?? "not yet selected"}.</p>
      </PolicySection>
      <PolicySection title="Research questions">
        <p>
          Support concerns the software and its operation. It is not a clinical
          interpretation or medical-advice service.
        </p>
      </PolicySection>
    </>
  );
}
