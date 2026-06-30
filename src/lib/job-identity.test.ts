import { describe, expect, it } from "vitest";

import { inferJobIdentity } from "./job-identity";

describe("job identity", () => {
  it("reads company and title from the first meaningful JD line", () => {
    expect(inferJobIdentity("\n美团 - 后端开发实习生\n负责 Java 服务开发")).toEqual({
      company: "美团",
      title: "后端开发实习生",
    });
  });

  it("uses explicit analysis before the JD line and safe generic fallbacks", () => {
    expect(inferJobIdentity("字节跳动 - 产品实习生", { company: "腾讯", title: "产品运营实习生" })).toEqual({
      company: "腾讯",
      title: "产品运营实习生",
    });
    expect(inferJobIdentity("负责用户研究和数据分析")).toEqual({
      company: "目标公司",
      title: "目标岗位",
    });
  });
});
