import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  Bell,
  CreditCard,
  Dna,
  Download,
  FlaskConical,
  History,
  Palette,
  Save,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PlanDemoControls } from "~/app/settings/plan-demo-controls";
import { ProfileRefresh } from "~/app/settings/profile-refresh";
import {
  PLAN_LIMITS,
  formatAllowedGenomes,
  formatPlanName,
  normalizePlanType,
  normalizeSubscriptionStatus,
  type PlanType,
} from "~/lib/plans";
import { createClient } from "~/utils/supabase/server";

const THEME_OPTIONS = new Set(["system", "dark", "light"]);

type SettingsProfile = {
  full_name: string | null;
  display_name: string | null;
  theme_preference: string | null;
  email_notifications: boolean | null;
  plan_type: unknown;
  subscription_status: unknown;
  plan_updated_at: string | null;
};

const PLAN_FEATURES = [
  {
    label: "Daily Evo2 predictions",
    value: (planType: PlanType) =>
      `${PLAN_LIMITS[planType].dailyPredictions.toLocaleString()} per day`,
    icon: Sparkles,
  },
  {
    label: "Genome assemblies",
    value: (planType: PlanType) => formatAllowedGenomes(planType),
    icon: Dna,
  },
  {
    label: "Prediction history",
    value: (planType: PlanType) =>
      PLAN_LIMITS[planType].predictionHistory ? "Enabled" : "Locked",
    icon: History,
  },
  {
    label: "CSV export",
    value: (planType: PlanType) =>
      PLAN_LIMITS[planType].csvExport ? "Enabled" : "Locked",
    icon: Download,
  },
  {
    label: "Disease association",
    value: (planType: PlanType) =>
      PLAN_LIMITS[planType].diseaseAssociation ? "Coming soon" : "Locked",
    icon: FlaskConical,
  },
] satisfies Array<{
  label: string;
  value: (planType: PlanType) => string;
  icon: LucideIcon;
}>;

const PLAN_CARDS = [
  {
    planType: "student",
    title: "Student",
    price: "Rs 0",
    cadence: "included",
    description: "Focused access for single-gene exploration and demos.",
    accent: false,
  },
  {
    planType: "researcher",
    title: "Researcher",
    price: "Rs 0",
    cadence: "demo",
    description: "More predictions, history, export, and every Human assembly.",
    accent: true,
  },
] satisfies Array<{
  planType: PlanType;
  title: string;
  price: string;
  cadence: string;
  description: string;
  accent: boolean;
}>;

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

async function updateProfileSettings(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = cleanText(formData.get("full_name"));
  const displayName = cleanText(formData.get("display_name"));
  const requestedTheme = cleanText(formData.get("theme_preference"));
  const themePreference = THEME_OPTIONS.has(requestedTheme)
    ? requestedTheme
    : "system";
  const emailNotifications = formData.get("email_notifications") === "on";

  const profileSettings = {
    full_name: fullName || null,
    display_name: displayName || null,
    theme_preference: themePreference,
    email_notifications: emailNotifications,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(profileSettings)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Failed to update profile settings:", updateError.message);
    redirect("/settings?status=error");
  }

  if (!updatedProfile) {
    console.error(
      "Profile row is missing. Run supabase/profile-settings.sql to backfill profiles.",
    );
    redirect("/settings?status=missing-profile");
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  redirect("/settings?status=saved");
}

async function updateDemoPlan(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const requestedAction = formData.get("demo_plan_action");
  const isReset = requestedAction === "reset";
  const now = new Date().toISOString();

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      plan_type: isReset ? "student" : "researcher",
      subscription_status: isReset ? "inactive" : "demo",
      plan_updated_at: now,
      updated_at: now,
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to update demo plan:", error.message);
    redirect("/settings?section=plan&status=plan-error");
  }

  if (!updatedProfile) {
    console.error(
      "Profile row is missing. Run supabase/profile-settings.sql to backfill profiles.",
    );
    redirect("/settings?section=plan&status=missing-profile");
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  redirect("/settings?section=plan&status=plan-updated");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string; status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select(
      "full_name, display_name, theme_preference, email_notifications, plan_type, subscription_status, plan_updated_at",
    )
    .eq("id", user.id)
    .single();
  const profile = profileData as SettingsProfile | null;

  const resolvedSearchParams = await searchParams;
  const status = resolvedSearchParams?.status;
  const section = resolvedSearchParams?.section === "plan" ? "plan" : "profile";
  const planType = normalizePlanType(profile?.plan_type);
  const subscriptionStatus = normalizeSubscriptionStatus(
    profile?.subscription_status,
  );
  const planUpdatedAt =
    typeof profile?.plan_updated_at === "string"
      ? new Date(profile.plan_updated_at).toLocaleDateString()
      : null;
  const requestedTheme = profile?.theme_preference ?? "system";
  const themePreference = THEME_OPTIONS.has(requestedTheme)
    ? requestedTheme
    : "system";
  const emailNotifications = profile?.email_notifications ?? true;

  if (section === "plan") {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8 md:px-6 lg:py-12">
        <ProfileRefresh enabled={status === "plan-updated"} />
        <div className="mb-8 flex flex-col items-center text-center">
          <p className="text-phosphor mb-3 text-xs font-semibold tracking-wide uppercase">
            Demo subscription
          </p>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight md:text-4xl">
            Upgrade your plan
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
            Compare Student and Researcher demo access. There are no payments,
            billing records, or real subscriptions connected.
          </p>
          <div className="border-border/50 bg-muted/70 mt-6 inline-flex rounded-full border p-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-9 rounded-full px-4"
              asChild
            >
              <a href="/settings?section=profile">Profile</a>
            </Button>
            <Button
              size="sm"
              className="bg-card text-foreground hover:bg-card h-9 rounded-full px-4 shadow-sm"
              asChild
            >
              <a href="/settings?section=plan">Plans</a>
            </Button>
          </div>
        </div>

        {status === "plan-updated" && (
          <div className="mx-auto mb-5 max-w-3xl rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Demo plan updated.
          </div>
        )}

        {status === "plan-error" && (
          <div className="mx-auto mb-5 max-w-3xl rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Could not update your plan. Confirm the Supabase SQL setup has been
            applied, then try again.
          </div>
        )}

        {status === "missing-profile" && (
          <div className="mx-auto mb-5 max-w-3xl rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Your account profile row is missing. Run the updated
            supabase/profile-settings.sql file in Supabase, then try again.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
          {PLAN_CARDS.map((planCard) => {
            const isCurrentPlan = planCard.planType === planType;

            return (
              <Card
                key={planCard.planType}
                className={`relative overflow-hidden rounded-[1.4rem] border p-0 transition duration-300 active:scale-[0.99] ${
                  planCard.accent
                    ? "border-phosphor/35 bg-[color-mix(in_srgb,var(--phosphor)_10%,var(--card))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "border-border/60 bg-card/95"
                } ${isCurrentPlan ? "ring-phosphor/45 ring-1" : ""}`}
              >
                {planCard.accent ? (
                  <div className="from-phosphor/16 pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent" />
                ) : null}
                <CardHeader className="relative gap-0 px-7 pt-7 pb-0">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-2xl font-semibold tracking-tight">
                        {planCard.title}
                      </CardTitle>
                      <CardDescription className="mt-2 min-h-10 max-w-md text-sm leading-5">
                        {planCard.description}
                      </CardDescription>
                    </div>
                    {isCurrentPlan ? (
                      <span className="border-phosphor/30 bg-phosphor/10 text-phosphor rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                        Current
                      </span>
                    ) : null}
                  </div>

                  <div className="mb-6 flex items-end gap-2">
                    <span className="text-foreground text-5xl font-semibold tracking-tight">
                      {planCard.price}
                    </span>
                    <span className="text-muted-foreground pb-2 text-sm">
                      / {planCard.cadence}
                    </span>
                  </div>

                  {isCurrentPlan ? (
                    <Button
                      className="bg-muted text-muted-foreground hover:bg-muted h-12 w-full rounded-full font-semibold"
                      disabled
                    >
                      Your current plan
                    </Button>
                  ) : (
                    <PlanDemoControls
                      className={`h-12 w-full rounded-full font-semibold active:scale-[0.98] ${
                        planCard.accent
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border-border/70 bg-card text-foreground hover:bg-muted"
                      }`}
                      formAction={updateDemoPlan}
                      planType={planType}
                    />
                  )}
                </CardHeader>
                <CardContent className="relative px-7 pt-7 pb-7">
                  <div className="border-border/45 divide-border/35 divide-y border-t">
                    {PLAN_FEATURES.map((feature) => {
                      const FeatureIcon = feature.icon;
                      const value = feature.value(planCard.planType);
                      const isLocked = value === "Locked";

                      return (
                        <div
                          key={feature.label}
                          className="grid grid-cols-[1.25rem_1fr] gap-3 py-4"
                        >
                          <FeatureIcon
                            className={`mt-0.5 h-4 w-4 ${
                              isLocked
                                ? "text-muted-foreground"
                                : "text-phosphor"
                            }`}
                            aria-hidden="true"
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {feature.label}
                            </p>
                            <p
                              className={`mt-1 text-sm ${
                                isLocked
                                  ? "text-muted-foreground"
                                  : "text-foreground/80"
                              }`}
                            >
                              {value}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-border/50 bg-card/90 mt-6 overflow-hidden rounded-[1.25rem]">
          <CardContent className="grid gap-0 p-0 md:grid-cols-3">
            <div className="border-border/40 border-b p-5 md:border-r md:border-b-0">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CreditCard className="text-phosphor h-4 w-4" />
                Active plan
              </p>
              <p className="mt-2 text-xl font-semibold">
                {formatPlanName(planType)}
              </p>
            </div>
            <div className="border-border/40 border-b p-5 md:border-r md:border-b-0">
              <p className="text-muted-foreground text-sm">Demo status</p>
              <p className="mt-2 text-xl font-semibold capitalize">
                {subscriptionStatus}
              </p>
            </div>
            <div className="p-5">
              <p className="text-muted-foreground text-sm">Last changed</p>
              <p className="mt-2 text-xl font-semibold">
                {planUpdatedAt ?? "Not recorded"}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 md:px-6">
      <ProfileRefresh enabled={status === "saved"} />
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account details and personal preferences.
        </p>
      </div>

      {status === "saved" && (
        <div className="mb-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          Profile settings saved.
        </div>
      )}

      {status === "error" && (
        <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not save your profile settings. Confirm the SQL setup has been
          applied in Supabase and try again.
        </div>
      )}

      {status === "missing-profile" && (
        <div className="mb-4 rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Your account profile row is missing. Run the updated
          supabase/profile-settings.sql file in Supabase, then try again.
        </div>
      )}

      <form action={updateProfileSettings}>
        <Card className="border-border/50 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="text-phosphor h-5 w-5" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="full_name"
                  className="text-muted-foreground text-sm font-medium"
                >
                  Full name
                </label>
                <Input
                  id="full_name"
                  name="full_name"
                  defaultValue={profile?.full_name ?? ""}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="display_name"
                  className="text-muted-foreground text-sm font-medium"
                >
                  Display name
                </label>
                <Input
                  id="display_name"
                  name="display_name"
                  defaultValue={profile?.display_name ?? ""}
                  placeholder="Name shown in the app"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  Email
                </label>
                <Input value={user.email ?? ""} disabled />
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  Current plan
                </label>
                <Input value={`${formatPlanName(planType)} Plan`} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="text-phosphor h-5 w-5" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="theme_preference"
                className="text-muted-foreground text-sm font-medium"
              >
                Theme preference
              </label>
              <select
                id="theme_preference"
                name="theme_preference"
                defaultValue={themePreference}
                className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="system">System default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            <label className="border-border/50 bg-muted/60 flex cursor-pointer items-start gap-3 rounded-md border p-4">
              <input
                type="checkbox"
                name="email_notifications"
                defaultChecked={emailNotifications}
                className="accent-phosphor mt-1 h-4 w-4"
              />
              <span className="flex flex-col gap-1">
                <span className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Bell className="text-phosphor h-4 w-4" />
                  Email notifications
                </span>
                <span className="text-muted-foreground text-sm">
                  Receive account and product updates by email.
                </span>
              </span>
            </label>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
              >
                <Save className="h-4 w-4" />
                Save settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
