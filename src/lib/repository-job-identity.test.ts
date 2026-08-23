import { describe, expect, it } from "vitest";

import { preserveConfirmedJobLabel } from "./repository";

describe("job identity", () => {
  it("fills placeholders once and preserves confirmed or manually corrected names", () => {
    expect(preserveConfirmedJobLabel("待填写公司", "字节跳动")).toBe("字节跳动");
    expect(preserveConfirmedJobLabel("字节跳动", "抖音AI")).toBe("字节跳动");
    expect(preserveConfirmedJobLabel("AI 产品实习生", "其他岗位")).toBe("AI 产品实习生");
  });
});
