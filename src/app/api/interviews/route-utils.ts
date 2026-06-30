import { ZodError } from "zod";

export function interviewRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ message: "面试请求参数不完整或格式不正确。" }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "面试请求失败，请稍后重试。";
  if (message.includes("未找到")) return Response.json({ message }, { status: 404 });
  if (message.includes("AI") || message.includes("模型") || message.includes("连接")) {
    return Response.json({ message }, { status: 502 });
  }
  return Response.json({ message }, { status: 400 });
}
