import { describe, expect, it } from "vitest";

import { deriveThreadTitle, parseStoredMessages } from "./thread-store";

describe("deriveThreadTitle", () => {
  it("uses the first user message without leaking later conversation text", () => {
    expect(deriveThreadTitle([
      { id: "a", role: "assistant", parts: [{ type: "text", text: "你好" }] },
      { id: "u", role: "user", parts: [{ type: "text", text: "  帮我记录   字节跳动前端实习生  " }] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "不应该用这句" }] },
    ] as never)).toBe("帮我记录 字节跳动前端实习生");
  });

  it("caps long titles and keeps an empty thread usable", () => {
    expect(deriveThreadTitle([])).toBe("新对话");
    expect([...deriveThreadTitle([
      { id: "u", role: "user", parts: [{ type: "text", text: "a".repeat(50) }] },
    ] as never)]).toHaveLength(28);
  });

  it("repairs legacy empty or duplicate message ids while reading history", () => {
    const messages = parseStoredMessages(JSON.stringify([
      { id: "", role: "assistant", parts: [{ type: "text", text: "旧消息" }] },
      { id: "same", role: "user", parts: [{ type: "text", text: "第一条" }] },
      { id: "same", role: "assistant", parts: [{ type: "text", text: "第二条" }] },
    ]));

    expect(messages.map((message) => message.id)).toEqual([
      "legacy-message-1",
      "same",
      "legacy-message-3",
    ]);
  });
});
