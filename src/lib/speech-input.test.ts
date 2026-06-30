import { describe, expect, it } from "vitest";

import { appendSpeechTranscript, speechRecognitionErrorMessage } from "./speech-input";

describe("speech input", () => {
  it("trims recognized text and appends it without replacing existing content", () => {
    expect(appendSpeechTranscript("已有内容", "  新识别内容  ", "\n", 100)).toBe("已有内容\n新识别内容");
    expect(appendSpeechTranscript("", "  第一段回答  ", " ", 100)).toBe("第一段回答");
  });

  it("ignores empty transcripts and respects the field length limit", () => {
    expect(appendSpeechTranscript("已有内容", "   ", "\n", 100)).toBe("已有内容");
    expect(appendSpeechTranscript("12345", "67890", "", 8)).toBe("12345678");
  });

  it("maps browser recognition failures to actionable Chinese messages", () => {
    expect(speechRecognitionErrorMessage("not-allowed")).toContain("麦克风权限");
    expect(speechRecognitionErrorMessage("no-speech")).toContain("没有识别到语音");
    expect(speechRecognitionErrorMessage("network")).toContain("网络");
  });
});
