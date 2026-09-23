// Owner-supplied publication details. Null means undecided, never a default policy.
export const publicSite: {
  name: string;
  sellerName: string | null;
  supportEmail: string | null;
  domain: string | null;
  refundPolicy: string | null;
  retentionPolicy: string | null;
  policiesApproved: boolean;
} = {
  name: "DNAAnalyzer",
  sellerName: "Aawaiz Azhar Spall",
  supportEmail: "aawaizazhar26@gmail.com",
  domain: null,
  refundPolicy: null,
  retentionPolicy:
    "Account data and saved variant inputs and results have no scheduled automatic expiry. This is an indefinite-retention choice, not a guarantee of permanent availability or protection against data loss.",
  policiesApproved: false,
};

export const publicLinks = [
  { href: "/product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
] as const;

export function isPublicPage(path: string) {
  return (
    path === "/login" ||
    path === "/login/" ||
    publicLinks.some(({ href }) => path === href || path === `${href}/`)
  );
}
