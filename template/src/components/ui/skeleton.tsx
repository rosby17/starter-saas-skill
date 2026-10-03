import { clsx } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-gray-200", className)} />;
}
