export function appendSpeechTranscript(
  current: string,
  transcript: string,
  separator: string,
  maxLength: number,
) {
  const nextTranscript = transcript.trim();
  if (!nextTranscript) return current;
  const prefix = current && !current.endsWith(separator) ? `${current}${separator}` : current;
  return `${prefix}${nextTranscript}`.slice(0, maxLength);
}

export function speechRecognitionErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "无法使用麦克风权限，请在浏览器设置中允许后重试。";
  }
  if (error === "no-speech") return "没有识别到语音，请靠近麦克风后重试。";
  if (error === "audio-capture") return "浏览器语音识别没有接管到麦克风，请确认系统默认输入设备可用后重试。";
  if (error === "network") return "语音识别网络连接失败，请稍后重试。";
  if (error === "aborted") return "语音输入已停止。";
  return "语音识别失败，请稍后重试。";
}
