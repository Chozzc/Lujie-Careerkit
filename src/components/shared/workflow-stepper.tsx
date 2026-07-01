import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function WorkflowStepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="grid grid-cols-3 overflow-hidden rounded-lg border border-line bg-surface">
      {labels.map((label, index) => (
        <li
          key={label}
          className={cn(
            "flex min-h-14 items-center gap-3 border-r border-line px-3 py-3 text-sm last:border-r-0 sm:px-4",
            index === current ? "bg-brand-muted text-brand" : index < current ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs", index <= current && "border-brand bg-brand text-white")}>
            {index < current ? <CheckCircle2 className="size-4" /> : index + 1}
          </span>
          <span className="font-medium">{label}</span>
        </li>
      ))}
    </ol>
  );
}
