"use client";

import { cn } from "@/lib/utils";

export default function GridBackground({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <div
        className={cn(
          "absolute inset-0 z-0",
          "[background-size:40px_40px]",
          "[background-image:linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)]",
        )}
      />

      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/25 [mask-image:radial-gradient(ellipse_at_center,transparent_35%,black)]" />

      <div className="relative z-[2]">{children}</div>
    </div>
  );
}
