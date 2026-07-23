"use client";

import { useState } from "react";
import { Check, Copy, FileText, MessageSquareText, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationMessageKind } from "@/lib/ai/application-message";
import type { ResumeContent } from "@/lib/types";
import { cn } from "@/lib/utils";

type GeneratedMessages = Record<ApplicationMessageKind, string>;

const emptyMessages: GeneratedMessages = {
  "cover-letter": "",
  greeting: "",
};

export function ApplicationMessageDialog({
  open,
  resume,
  onOpenChange,
}: {
  open: boolean;
  resume: ResumeContent;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("resumeWorkbench.applicationMessageDialog");
  const locale = useLocale() === "en" ? "en" : "zh-CN";
  const [kind, setKind] = useState<ApplicationMessageKind>("cover-letter");
  const [jd, setJd] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [messages, setMessages] = useState<GeneratedMessages>(emptyMessages);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const content = messages[kind];

  async function generate() {
    if (!jd.trim() || isGenerating) {
      if (!jd.trim()) setStatus(t("jdRequired"));
      return;
    }

    setIsGenerating(true);
    setCopied(false);
    setStatus(t("generating"));
    try {
      const response = await fetch("/api/ai/application-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          jd,
          resume,
          extraContext,
          locale,
        }),
      });
      const payload = (await response.json()) as {
        content?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.content) {
        throw new Error(payload.message || payload.error || t("failed"));
      }
      setMessages((current) => ({ ...current, [kind]: payload.content ?? "" }));
      setStatus(payload.message ?? t("done"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("failed"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyContent() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setStatus(t("copied"));
    } catch {
      setStatus(t("copyFailed"));
    }
  }

  function selectKind(nextKind: ApplicationMessageKind) {
    setKind(nextKind);
    setCopied(false);
    setStatus("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <MessageKindButton
            active={kind === "cover-letter"}
            icon={FileText}
            title={t("kinds.coverLetter.title")}
            description={t("kinds.coverLetter.description")}
            onClick={() => selectKind("cover-letter")}
          />
          <MessageKindButton
            active={kind === "greeting"}
            icon={MessageSquareText}
            title={t("kinds.greeting.title")}
            description={t("kinds.greeting.description")}
            onClick={() => selectKind("greeting")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="application-message-jd">{t("jdLabel")}</Label>
          <Textarea
            id="application-message-jd"
            value={jd}
            onChange={(event) => setJd(event.target.value)}
            placeholder={t("jdPlaceholder")}
            className="min-h-32 resize-y"
            maxLength={50_000}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="application-message-context">{t("extraLabel")}</Label>
            <span className="text-xs text-muted-foreground">{t("extraHint")}</span>
          </div>
          <Textarea
            id="application-message-context"
            value={extraContext}
            onChange={(event) => setExtraContext(event.target.value)}
            placeholder={t(`kinds.${kind === "greeting" ? "greeting" : "coverLetter"}.extraPlaceholder`)}
            className="min-h-20 resize-y"
            maxLength={2_000}
          />
        </div>

        {content ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="application-message-result">{t("resultLabel")}</Label>
              <span className="text-xs text-muted-foreground">{t("editableHint")}</span>
            </div>
            <Textarea
              id="application-message-result"
              value={content}
              onChange={(event) =>
                setMessages((current) => ({ ...current, [kind]: event.target.value }))
              }
              className="min-h-48 resize-y bg-surface-low leading-7"
            />
          </div>
        ) : null}

        {status ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {status}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("close")}</DialogClose>
          {content ? (
            <Button variant="outline" onClick={() => void copyContent()}>
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? t("copied") : t("copy")}
            </Button>
          ) : null}
          <Button disabled={isGenerating || !jd.trim()} onClick={() => void generate()}>
            <Sparkles data-icon="inline-start" />
            {isGenerating ? t("generatingButton") : content ? t("regenerate") : t("generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageKindButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof FileText;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-primary bg-primary-soft text-foreground"
          : "border-line bg-background hover:bg-surface-low",
      )}
    >
      <span className={cn("mt-0.5 rounded-lg p-2", active ? "bg-white text-primary" : "bg-surface-low text-muted-foreground")}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
