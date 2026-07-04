import { ArrowDownToLine, ArrowUpRight } from "lucide-react";

import { Button } from "~/components/ui/button";
import { type PlanType } from "~/lib/plans";

type DemoAction = "upgrade" | "reset";

export function PlanDemoControls({
  className,
  formAction,
  planType,
}: {
  className?: string;
  formAction: (formData: FormData) => void | Promise<void>;
  planType: PlanType;
}) {
  const demoAction: DemoAction =
    planType === "researcher" ? "reset" : "upgrade";
  const buttonLabel =
    demoAction === "upgrade"
      ? "Upgrade to Researcher Demo"
      : "Downgrade to Student";

  return (
    <form action={formAction}>
      <input type="hidden" name="demo_plan_action" value={demoAction} />
      <Button
        type="submit"
        className={className ?? "active:scale-[0.98]"}
        variant={demoAction === "upgrade" ? "default" : "outline"}
      >
        {demoAction === "upgrade" ? (
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
        )}
        {buttonLabel}
      </Button>
    </form>
  );
}
