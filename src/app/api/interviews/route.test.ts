import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  saveProgress: vi.fn(),
  deleteSession: vi.fn(),
  clearSessions: vi.fn(),
}));

vi.mock("@/lib/interview-runtime", () => ({
  interviewService: runtimeMocks,
}));

import { DELETE as DELETE_ONE, GET, PATCH } from "./[id]/route";
import { DELETE as DELETE_ALL, GET as GET_ALL, POST } from "./route";

describe("interview routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an incomplete create payload", async () => {
    const response = await POST(jsonRequest("http://localhost/api/interviews", { jobId: "job-1" }));
    expect(response.status).toBe(400);
    expect(runtimeMocks.createSession).not.toHaveBeenCalled();
  });

  it("creates a session from a valid payload", async () => {
    runtimeMocks.createSession.mockResolvedValue({ id: "session-1" });
    const body = {
      jobId: "job-1",
      resumeVersionId: null,
      mode: "comprehensive",
      context: {
        company: "腾讯",
        title: "产品运营实习生",
        jd: "负责用户研究、活动复盘和数据分析",
        resumeName: "主简历",
        resume: { basics: { name: "陈同学" } },
      },
    };
    const response = await POST(jsonRequest("http://localhost/api/interviews", body));
    expect(response.status).toBe(201);
    expect(runtimeMocks.createSession).toHaveBeenCalledWith(body);
  });

  it("warms the collection route without creating a session", async () => {
    const response = await GET_ALL();

    expect(response.status).toBe(204);
    expect(runtimeMocks.createSession).not.toHaveBeenCalled();
  });

  it("reads and updates an existing session", async () => {
    runtimeMocks.getSession.mockResolvedValue({ id: "session-1" });
    runtimeMocks.saveProgress.mockResolvedValue({ id: "session-1", currentQuestionIndex: 1 });
    const context = { params: Promise.resolve({ id: "session-1" }) };

    expect((await GET(new Request("http://localhost/api/interviews/session-1"), context)).status).toBe(200);
    const response = await PATCH(
      jsonRequest("http://localhost/api/interviews/session-1", { currentQuestionIndex: 1 }),
      context,
    );
    expect(response.status).toBe(200);
    expect(runtimeMocks.saveProgress).toHaveBeenCalledWith("session-1", { currentQuestionIndex: 1 });
  });

  it("deletes one session or clears all sessions", async () => {
    runtimeMocks.deleteSession.mockResolvedValue(undefined);
    runtimeMocks.clearSessions.mockResolvedValue(3);
    const context = { params: Promise.resolve({ id: "session-1" }) };

    expect((await DELETE_ONE(new Request("http://localhost/api/interviews/session-1"), context)).status).toBe(200);
    expect(runtimeMocks.deleteSession).toHaveBeenCalledWith("session-1");

    const response = await DELETE_ALL();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedCount: 3 });
  });
});

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
