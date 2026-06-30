"use client";

import { useCallback, useLayoutEffect, useRef, type ComponentProps } from "react";
import { LoaderCircle, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { appendSpeechTranscript } from "@/lib/speech-input";
import { cn } from "@/lib/utils";

type SpeechTextareaProps = Omit<ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  speechSeparator?: string;
  wrapperClassName?: string;
};

export function SpeechTextarea({
  value,
  onValueChange,
  speechSeparator = "\n",
  wrapperClassName,
  className,
  maxLength = 8000,
  disabled,
  ...props
}: SpeechTextareaProps) {
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);
  const handleTranscript = useCallback((transcript: string) => {
    const nextValue = appendSpeechTranscript(valueRef.current, transcript, speechSeparator, maxLength);
    valueRef.current = nextValue;
    onValueChange(nextValue);
  }, [maxLength, onValueChange, speechSeparator]);
  const speech = useSpeechRecognition(handleTranscript);
  const isBusy = speech.isPreparing || speech.isTranscribing;
  const label = !speech.isSupported
    ? "当前浏览器不支持语音输入"
    : speech.isPreparing
      ? "正在准备语音输入"
      : speech.isTranscribing
        ? "正在转写语音"
    : speech.isListening
      ? "停止语音输入"
      : "开始语音输入";

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Textarea
        {...props}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        className={cn("pr-12", className)}
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant={speech.isListening ? "secondary" : "outline"}
                size="icon-sm"
                className="absolute top-2 right-2 bg-background"
                disabled={disabled || !speech.isSupported || isBusy}
                aria-label={label}
                aria-pressed={speech.isListening}
                title={label}
                onClick={speech.isListening ? speech.stop : speech.start}
              >
                {isBusy ? <LoaderCircle className="animate-spin" /> : speech.isListening ? <Square /> : <Mic />}
              </Button>
            }
          />
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {speech.isListening || isBusy || speech.error || speech.statusMessage ? (
        <p
          role="status"
          className={cn(
            "mt-1 text-xs",
            speech.error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {speech.error
            || (speech.interimText ? `正在识别：${speech.interimText}` : speech.statusMessage || "正在聆听...")}
        </p>
      ) : null}
    </div>
  );
}
