import { describe, expect, it } from "vitest";

import { analyzeJobInput, jobAnalysisInputSchema } from "./job-analysis";

describe("analyzeJobInput", () => {
  it("extracts a practical campus job profile from pasted JD text", () => {
    const result = analyzeJobInput(`
      字节跳动 - 前端开发实习生
      base：北京/上海，可转正，投递截止：2026-06-20
      岗位职责：参与抖音电商活动页开发，负责 React 组件、性能优化和数据埋点。
      任职要求：熟悉 JavaScript、TypeScript、React，了解浏览器渲染和网络请求。
      加分项：有大型项目经验，熟悉 Next.js 或工程化。
    `);

    expect(result.company).toBe("字节跳动");
    expect(result.title).toBe("前端开发实习生");
    expect(result.deadline).toBe("2026-06-20");
    expect(result.keywords).toEqual(
      expect.arrayContaining(["React", "TypeScript", "JavaScript", "Next.js"]),
    );
    expect(result.requirements.length).toBeGreaterThan(0);
    expect(result.bonusPoints.join("")).toContain("工程化");
    expect(result).not.toHaveProperty("matchScore");
  });

  it("returns an empty-state friendly analysis when JD text is blank", () => {
    const result = analyzeJobInput("");

    expect(result.company).toBe("待填写公司");
    expect(result.title).toBe("待分析岗位");
    expect(result.keywords).toEqual([]);
    expect(result.risks).toContain("缺少岗位 JD，无法判断关键词和匹配缺口。");
    expect(result).not.toHaveProperty("matchScore");
  });

  it("rejects invalid calendar dates and non-string list values", () => {
    const valid = analyzeJobInput("美团 - 后端开发实习生\n要求 Java");

    expect(jobAnalysisInputSchema.safeParse({ ...valid, deadline: "2026-02-30" }).success).toBe(false);
    expect(jobAnalysisInputSchema.safeParse({ ...valid, risks: [42] }).success).toBe(false);
  });
});
