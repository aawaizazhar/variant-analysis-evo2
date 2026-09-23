import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingPanel } from "~/components/billing-panel";
import { createClient } from "~/utils/supabase/server";

export default async function CheckoutPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <BillingPanel />
      <Link href="/" className="text-phosphor inline-block text-sm underline">
        Open the application
      </Link>
    </main>
  );
}
