"use client";

import { initializePaddle, CheckoutEventNames } from "@paddle/paddle-js";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";

export function PaddleCheckout({ transactionId }: { transactionId: string }) {
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const router = useRouter();
  async function open() {
    setOpening(true);
    setError("");
    try {
      const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
      const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
      if (!token || !["sandbox", "live"].includes(environment ?? ""))
        throw new Error("Checkout is not configured.");
      const paddle = await initializePaddle({
        token,
        environment: environment === "sandbox" ? "sandbox" : "production",
        eventCallback(event) {
          if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED)
            router.push("/billing/success");
          if (event.name === CheckoutEventNames.CHECKOUT_CLOSED)
            setOpening(false);
          if (event.name === CheckoutEventNames.CHECKOUT_ERROR) {
            setOpening(false);
            setError("Checkout could not complete. Please try again.");
          }
        },
      });
      if (!paddle)
        throw new Error(
          "Could not load checkout. Check your connection and try again.",
        );
      paddle.Checkout.open({
        transactionId,
        settings: {
          displayMode: "overlay",
          allowLogout: false,
          showAddDiscounts: false,
          successUrl: `${window.location.origin}/billing/success`,
        },
      });
    } catch (cause) {
      setOpening(false);
      setError(
        cause instanceof Error ? cause.message : "Checkout could not open.",
      );
    }
  }
  return (
    <div className="mt-6 space-y-4">
      <Button disabled={opening} onClick={() => void open()}>
        {opening ? "Checkout is open…" : "Continue to secure checkout"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-sm">
        Closing checkout preserves this purchase attempt so you can resume it.
      </p>
    </div>
  );
}
