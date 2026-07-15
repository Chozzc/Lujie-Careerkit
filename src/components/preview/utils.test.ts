import { describe, expect, it } from "vitest";

import { isSectionEmpty, md } from "./utils";

describe("preview utilities", () => {
  it("preserves a line break after inline markdown", () => {
    expect(md("**重点**\n下一行")).toBe("<strong>重点</strong><br>下一行");
  });

  it("escapes user HTML before applying supported markdown", () => {
    expect(md("**<script>alert(1)</script>**")).toBe(
      "<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>",
    );
  });

  it("treats malformed legacy section content as empty", () => {
    expect(isSectionEmpty({ type: "skills", content: null } as never)).toBe(true);
  });
});
