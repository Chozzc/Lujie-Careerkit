"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { TEMPLATES } from "@/lib/constants";
import type { Resume } from "@/types/resume";

export function ResumeTemplateBar({
  resume,
  onTemplateChange,
}: {
  resume: Resume;
  onTemplateChange: (template: string) => void;
}) {
  const t = useTranslations("resumeWorkbench.templateBar");
  const templateT = useTranslations("app.resumeLibrary.templates");

  return (
    <div data-tour="template-gallery" className="flex h-11 shrink-0 items-center border-b bg-background px-4">
      <span className="mr-2 shrink-0 text-[0.6875rem] font-medium text-muted-foreground">{t("label")}</span>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {TEMPLATES.map((template) => (
          <Button
            key={template}
            variant={resume.template === template ? "default" : "ghost"}
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => onTemplateChange(template)}
          >
            {templateT(template)}
          </Button>
        ))}
      </div>
    </div>
  );
}
