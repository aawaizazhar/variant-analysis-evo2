"use client";

import { useEffect } from "react";
import { useAuth } from "~/providers/auth-provider";

export function ProfileRefresh({ enabled }: { enabled: boolean }) {
  const { refreshProfile } = useAuth();

  useEffect(() => {
    if (!enabled) return;
    refreshProfile().catch(console.error);
  }, [enabled, refreshProfile]);

  return null;
}
