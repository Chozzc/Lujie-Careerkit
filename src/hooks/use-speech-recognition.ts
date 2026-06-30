"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { speechRecognitionErrorMessage } from "@/lib/speech-input";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: (() => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function useSpeechRecognition(onFinalTranscript: (transcript: string) => void) {
  const callbackRef = useRef(onFinalTranscript);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const manuallyStoppedRef = useRef(false);
  const heardSpeechRef = useRef(false);
  const failedRef = useRef(false);
  const isSupported = useSyncExternalStore(
    subscribeToSpeechSupport,
    () => Boolean(getSpeechRecognitionConstructor() && canRequestMicrophone()),
    () => false,
  );
  const [isListening, setIsListening] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    callbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    manuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      setIsPreparing(false);
      setIsListening(false);
      setStatusMessage("");
    }
  }, []);

  const start = useCallback(() => {
    if (isListening || isPreparing) return;

    const Constructor = getSpeechRecognitionConstructor();
    if (!Constructor) {
      setError("当前浏览器不支持语音输入，请使用最新版 Chrome 或 Edge。");
      return;
    }
    if (!canRequestMicrophone()) {
      setError("当前浏览器无法访问麦克风，请使用最新版 Chrome 或 Edge 并确认页面为 localhost 或 HTTPS。");
      return;
    }

    void (async () => {
      recognitionRef.current?.abort();
      manuallyStoppedRef.current = false;
      heardSpeechRef.current = false;
      failedRef.current = false;
      setError("");
      setInterimText("");
      setStatusMessage("正在连接麦克风...");
      setIsPreparing(true);

      try {
        await checkMicrophoneAccess();
      } catch (reason) {
        setIsPreparing(false);
        setStatusMessage("");
        setError(microphoneAccessErrorMessage(reason));
        return;
      }
      if (manuallyStoppedRef.current) {
        setIsPreparing(false);
        setStatusMessage("");
        return;
      }

      const recognition = new Constructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "zh-CN";
      recognition.onstart = () => {
        setIsPreparing(false);
        setIsListening(true);
        setStatusMessage("正在聆听，完成后点击停止。");
      };
      recognition.onresult = (event) => {
        let finalTranscript = "";
        let nextInterimText = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript?.trim() ?? "";
          if (!transcript) continue;

          heardSpeechRef.current = true;
          if (result.isFinal) finalTranscript += `${transcript} `;
          else nextInterimText += `${transcript} `;
        }

        setInterimText(nextInterimText.trim());
        if (finalTranscript.trim()) callbackRef.current(finalTranscript.trim());
      };
      recognition.onerror = (event) => {
        setIsPreparing(false);
        setIsListening(false);
        setInterimText("");
        if (event.error !== "aborted") {
          failedRef.current = true;
          setError(speechRecognitionErrorMessage(event.error));
          setStatusMessage("");
        }
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setIsPreparing(false);
        setIsListening(false);
        setInterimText("");
        setStatusMessage("");
        if (!manuallyStoppedRef.current && !heardSpeechRef.current && !failedRef.current) {
          setError("没有识别到语音，请靠近麦克风后重试。");
        }
      };

      try {
        recognitionRef.current = recognition;
        setStatusMessage("麦克风已连接，正在启动语音识别...");
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setIsPreparing(false);
        setIsListening(false);
        setStatusMessage("");
        setError("语音输入启动失败，请刷新页面或检查浏览器麦克风权限。");
      }
    })();
  }, [isListening, isPreparing]);

  return {
    error,
    interimText,
    isListening,
    isPreparing,
    isSupported,
    isTranscribing: false,
    start,
    statusMessage,
    stop,
  };
}

function subscribeToSpeechSupport() {
  return () => undefined;
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function canRequestMicrophone() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

async function checkMicrophoneAccess() {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } finally {
    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }
  }
}

function microphoneAccessErrorMessage(reason: unknown) {
  if (reason instanceof DOMException) {
    if (reason.name === "NotAllowedError" || reason.name === "PermissionDeniedError") {
      return "无法使用麦克风权限，请在浏览器设置中允许后重试。";
    }
    if (reason.name === "NotFoundError" || reason.name === "DevicesNotFoundError") {
      return "没有检测到可用麦克风，请确认系统已接入麦克风并允许浏览器使用。";
    }
    if (reason.name === "NotReadableError" || reason.name === "TrackStartError") {
      return "麦克风可能正被其他应用占用，请关闭占用麦克风的软件后重试。";
    }
    if (reason.name === "SecurityError") {
      return "当前页面无法访问麦克风，请确认使用 localhost 或 HTTPS。";
    }
  }
  return reason instanceof Error ? reason.message : "麦克风启动失败，请稍后重试。";
}
