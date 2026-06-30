"use client";

import type { ComponentProps, ComponentType, ReactNode } from "react";
import { Settings, Upload } from "lucide-react";

import { ResumeSourcePicker } from "@/components/resume-source-picker";
import { SpeechTextarea } from "@/components/speech-textarea";
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

type ResumePickerProps = Omit<ComponentProps<typeof ResumeSourcePicker>, "className">;

export function ResumeJdPreparation({
  resumePicker,
  title,
  description,
  jdLabel,
  jdValue,
  onJdChange,
  jdPlaceholder,
  settingsTitle,
  settingsDescription,
  settings,
  footer,
  notice,
  onJdImportStatus,
}: {
  resumePicker: ResumePickerProps;
  title: string;
  description: string;
  jdLabel: string;
  jdValue: string;
  onJdChange: (value: string) => void;
  jdPlaceholder: string;
  settingsTitle: string;
  settingsDescription: string;
  settings: ReactNode;
  footer: ReactNode;
  notice?: ReactNode;
  onJdImportStatus?: (message: string) => void;
}) {
  async function importJdFile(file?: File) {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      onJdImportStatus?.("JD 上传目前支持 txt 或 md 文件。");
      return;
    }
    const text = (await file.text()).trim();
    if (!text) {
      onJdImportStatus?.("上传的 JD 文件内容为空。");
      return;
    }
    onJdChange(text);
    onJdImportStatus?.(`已从 ${file.name} 导入 ${text.length} 字职位描述。`);
  }

  return (
    <section className="rounded-lg border border-line bg-surface shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
      <div className="grid xl:grid-cols-[320px_minmax(0,1fr)]">
        <ResumeSourcePicker
          {...resumePicker}
          className="border-b border-line lg:border-b-0 xl:h-[760px] xl:self-start xl:border-r"
        />

        <section className="flex min-w-0 flex-col">
          <div className="shrink-0 p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-low">
                <Upload className="h-4 w-4" />
                上传 JD
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={(event) => {
                    void importJdFile(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="space-y-5 p-5 lg:p-6">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">{jdLabel}</span>
              <SpeechTextarea
                required
                maxLength={8000}
                value={jdValue}
                onValueChange={onJdChange}
                placeholder={jdPlaceholder}
                wrapperClassName="mt-2"
                className="min-h-[210px] resize-y bg-surface-low px-4 py-4 text-sm leading-7"
              />
              <span className="mt-1 block text-right text-xs text-muted-foreground">{jdValue.length} / 8000</span>
            </label>

            <div className="-mx-5 px-5 pt-6 lg:-mx-6 lg:px-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground">{settingsTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{settingsDescription}</p>
              </div>
              {settings}
            </div>
          </div>

          <div className="shrink-0 border-t border-line px-5 py-4 lg:px-6">{footer}</div>
        </section>
      </div>
      {notice ? <div className="border-t border-line px-5 py-4 lg:px-6">{notice}</div> : null}
    </section>
  );
}

export function AiSetupRequiredDialog({
  open,
  message,
  onOpenChange,
  onOpenSettings,
}: {
  open: boolean;
  message: string;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}) {
  function handleOpenSettings() {
    onOpenChange(false);
    onOpenSettings();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-b border-line p-5">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            需要先配置 AI
          </DialogTitle>
          <DialogDescription className="mt-2 leading-6">
            {message || "请先在设置页启用 AI，并完成连接测试后再继续。"}
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 py-4 text-sm leading-6 text-muted-foreground">
          API Key 会加密保存在本机数据库，不会以明文返回到前端。
        </div>
        <DialogFooter className="p-4">
          <DialogClose render={<Button type="button" variant="outline" />}>稍后再说</DialogClose>
          <Button type="button" onClick={handleOpenSettings}>前往设置</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PreparationOptionCard({
  checked,
  icon: Icon,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex min-h-24 w-full items-center justify-between gap-4 rounded-lg border px-4 py-4 text-left transition",
        checked ? "border-primary/30 bg-primary-soft/35" : "border-line bg-white hover:bg-surface-low",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-low text-primary"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="block text-[0.8125rem] leading-5 font-semibold text-foreground">{label}</span>
          <span className="mt-1 block text-[0.75rem] leading-5 text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-surface-mid")} aria-hidden>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition", checked ? "left-4" : "left-0.5")} />
      </span>
    </button>
  );
}
