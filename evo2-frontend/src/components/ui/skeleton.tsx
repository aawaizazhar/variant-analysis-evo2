import * as React from "react";
import { cn } from "~/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-elevated animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
