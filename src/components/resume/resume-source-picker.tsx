"use client";

import type { DragEvent, KeyboardEvent } from "react";
import { useRef } from "react";
import { Check, FileText, LoaderCircle, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RESUME_UPLOAD_ACCEPT, type UploadedResumeDraft } from "@/lib/resume-upload";
import { cn } from "@/lib/utils";

export type ResumePickerOption = {
  id: string;
  name: string;
  detail: string;
};

export function ResumeSourcePicker({
  title,
  description,
  source,
  selectedId,
  options,
  uploadedResume,
  uploadError,
  isUploading = false,
  onSourceChange,
  onSelect,
  onUploadFile,
  onUploadRequest,
  onOpenResume,
  className,
}: {
  title?: string;
  description: string;
  source: "library" | "upload";
  selectedId?: string;
  options: ResumePickerOption[];
  uploadedResume: UploadedResumeDraft | null;
  uploadError: string;
  isUploading?: boolean;
  onSourceChange: (source: "library" | "upload") => void;
  onSelect: (id: string) => void;
  onUploadFile: (file: File) => void;
  onUploadRequest?: (openFileDialog: () => void) => void;
  onOpenResume?: (id: string) => void;
  className?: string;
}) {
  const t = useTranslations("resumeSourcePicker");
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function openFileDialog() {
    if (!isUploading) uploadInputRef.current?.click();
  }

  function requestUpload() {
    if (isUploading) return;
    if (onUploadRequest) {
      onUploadRequest(openFileDialog);
      return;
    }
    openFileDialog();
  }

  function handleUploadKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    requestUpload();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isUploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onUploadFile(file);
  }

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden p-5 lg:p-6", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold">{title ?? t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <FileText className="size-5 text-primary" />
      </div>

      <ToggleGroup
        value={[source]}
        onValueChange={(value) => {
          const next = value[0];
          if (next === "library" || next === "upload") onSourceChange(next);
        }}
        variant="outline"
        spacing={0}
        className="mb-4 grid w-full grid-cols-2 bg-surface-low p-1"
      >
        <ToggleGroupItem value="library" className="w-full">{t("library")}</ToggleGroupItem>
        <ToggleGroupItem value="upload" className="w-full">{t("upload")}</ToggleGroupItem>
      </ToggleGroup>

      {source === "library" ? (
        options.length ? (
          <ToggleGroup
            value={selectedId ? [selectedId] : []}
            onValueChange={(value) => {
              if (value[0]) onSelect(value[0]);
            }}
            orientation="vertical"
            variant="outline"
            className="resume-library-scroll min-h-0 flex-1 w-full items-stretch overflow-y-scroll pr-2 [scrollbar-gutter:stable]"
          >
            {options.map((option) => (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                onDoubleClick={() => onOpenResume?.(option.id)}
                className="h-auto min-h-20 w-full justify-between px-4 py-3 text-left whitespace-normal"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.detail}</span>
                  {onOpenResume ? <span className="mt-1 block text-[0.6875rem] text-muted-foreground">{t("doubleClickEdit")}</span> : null}
                </span>
                {selectedId === option.id ? <Check className="shrink-0" /> : null}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-line px-4 text-center text-sm leading-6 text-muted-foreground">
            {t("empty")}
          </div>
        )
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <div
            role="button"
            tabIndex={isUploading ? -1 : 0}
            aria-disabled={isUploading}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onClick={requestUpload}
            onKeyDown={handleUploadKeyDown}
            className={cn(
              "flex min-h-80 flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-low px-5 py-8 text-center transition hover:border-primary/60 hover:bg-primary-soft/40",
              isUploading && "cursor-wait opacity-80",
            )}
          >
            <input
              ref={uploadInputRef}
              type="file"
              className="hidden"
              disabled={isUploading}
              accept={RESUME_UPLOAD_ACCEPT}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && !isUploading) onUploadFile(file);
                event.currentTarget.value = "";
              }}
            />
            <span className="grid size-12 place-items-center rounded-lg bg-background text-primary shadow-sm">
              {isUploading ? <LoaderCircle className="size-5 animate-spin" /> : <Upload className="size-5" />}
            </span>
            <span className="mt-4 text-sm font-semibold text-foreground">{isUploading ? t("parsing") : t("import")}</span>
            <span className="mt-1 text-sm text-muted-foreground">{isUploading ? t("waiting") : t("drag")}</span>
            <span className="mt-3 text-xs text-muted-foreground">{t("supported")}</span>
            {uploadedResume ? (
              <span className="mt-4 max-w-full truncate rounded-md bg-background px-3 py-2 text-xs text-primary shadow-sm">
                {t("selected", { fileName: uploadedResume.fileName, count: uploadedResume.characterCount })}
              </span>
            ) : null}
            {uploadError ? <span className="mt-3 text-xs text-destructive">{uploadError}</span> : null}
          </div>
          <div className="rounded-lg border border-line bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
            {t("snapshotOnly")}
          </div>
        </div>
      )}
    </section>
  );
}
