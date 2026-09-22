import Link from "next/link";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
        className,
      )}
    >
      A
    </span>
  );
}

export function Brand({
  href = "/",
  label = "Atlas — вернуться на карту",
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "focus-visible:ring-ring/50 flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-[3px]",
        className,
      )}
    >
      <BrandMark />
      <span>Atlas</span>
    </Link>
  );
}
