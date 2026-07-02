"use client";

import type { LucideIcon } from "lucide-react";
import { Download, FileText, FileType, Image as ImageIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ResumeExportFormat = "pdf" | "word" | "image";

const exportOptions: Array<{
  format: ResumeExportFormat;
  icon: LucideIcon;
}> = [
  { format: "pdf", icon: FileText },
  { format: "word", icon: FileType },
  { format: "image", icon: ImageIcon },
];

export function ResumeExportDialog({
  open,
  exportingFormat,
  onOpenChange,
  onExport,
}: {
  open: boolean;
  exportingFormat: ResumeExportFormat | null;
  onOpenChange: (open: boolean) => void;
  onExport: (format: ResumeExportFormat) => void;
}) {
  const t = useTranslations("resumeWorkbench.exportDialog");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-b border-line p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                <Download className="h-5 w-5 text-emerald-600" />
                {t("title")}
              </DialogTitle>
              <DialogDescription className="mt-2">{t("description")}</DialogDescription>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon" title={t("close")} />}>
              <X />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            const active = exportingFormat === option.format;
            return (
              <button
                key={option.format}
                type="button"
                onClick={() => onExport(option.format)}
                disabled={Boolean(exportingFormat)}
                className={cn(
                  "flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface p-4 text-center transition hover:border-primary/40 hover:bg-primary-soft disabled:cursor-wait disabled:opacity-70",
                  active && "border-emerald-500 bg-emerald-50 text-emerald-700",
                )}
              >
                <Icon className="h-8 w-8" />
                <span className="text-base font-semibold">{active ? t("exporting") : t(`formats.${option.format}.title`)}</span>
                <span className="text-xs text-muted-foreground">{t(`formats.${option.format}.subtitle`)}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="p-4">
          <DialogClose render={<Button variant="outline" disabled={Boolean(exportingFormat)} />}>{t("cancel")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
