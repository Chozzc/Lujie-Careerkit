import { describe, expect, it } from "vitest";

import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  buildPagedResumeModeCSS,
  calculateFitPreviewZoom,
  calculateResumePagination,
  getCombinedPageImageLayout,
} from "./resume-export-layout";

describe("resume export layout", () => {
  it("centers smart-one-page scaled content instead of anchoring it to the left edge", () => {
    const pagination = calculateResumePagination(1300, true);

    expect(pagination.pageCount).toBe(1);
    expect(pagination.fitScale).toBeCloseTo(A4_HEIGHT_PX / 1300, 4);
    expect(pagination.horizontalOffset).toBeCloseTo((A4_WIDTH_PX * (1 - pagination.fitScale)) / 2, 4);
    expect(pagination.horizontalOffset).toBeGreaterThan(0);
    expect(pagination.smartOnePageApplied).toBe(true);
  });

  it("refuses smart-one-page compression when the content is too long to remain readable", () => {
    const pagination = calculateResumePagination(1800, true);

    expect(pagination.smartOnePageApplied).toBe(false);
    expect(pagination.smartOnePageOverflow).toBe(true);
    expect(pagination.pageCount).toBe(2);
    expect(pagination.fitScale).toBe(1);
  });

  it("keeps normal pagination full-width and unshifted", () => {
    const pagination = calculateResumePagination(1800, false);

    expect(pagination.pageCount).toBe(2);
    expect(pagination.fitScale).toBe(1);
    expect(pagination.horizontalOffset).toBe(0);
  });

  it("uses safe measured boundaries and adds breathing room above continuation pages", () => {
    const pagination = calculateResumePagination(1900, false, [1040, 1100, 1140]);

    expect(pagination.pageSlices).toEqual([
      { sourceStart: 0, sourceEnd: 1100, topInset: 0 },
      { sourceStart: 1100, sourceEnd: 1900, topInset: 32 },
    ]);
  });

  it.each([0.1, 0.5, 1])("fits a %spx measurement overflow onto one page without clipping", (overflow) => {
    const contentHeight = A4_HEIGHT_PX + overflow;
    const pagination = calculateResumePagination(contentHeight, false);

    expect(pagination.pageCount).toBe(1);
    expect(pagination.fitScale).toBeCloseTo(A4_HEIGHT_PX / contentHeight, 6);
    expect(pagination.pageSlices[0].sourceEnd).toBe(contentHeight);
  });

  it("keeps real content overflow on a continuation page", () => {
    const contentHeight = A4_HEIGHT_PX + 1.01;
    const pagination = calculateResumePagination(contentHeight, false);

    expect(pagination.pageCount).toBe(2);
    expect(pagination.fitScale).toBe(1);
    expect(pagination.pageSlices.at(-1)?.sourceEnd).toBe(contentHeight);
  });

  it("removes web-card chrome when rendering a resume inside an A4 page", () => {
    const css = buildPagedResumeModeCSS('[data-theme-scope="preview"]');

    expect(css).toContain('data-resume-render-mode="paged"');
    expect(css).toContain('data-resume-render-mode="export"');
    expect(css).toContain("max-width: none !important");
    expect(css).toContain("box-shadow: none !important");
    expect(css).toContain(`min-height: ${A4_HEIGHT_PX}px !important`);
  });

  it("exports stitched PNG pages as full white A4 images without preview gutters", () => {
    const layout = getCombinedPageImageLayout(2);

    expect(layout).toEqual({
      width: A4_WIDTH_PX * 2,
      height: A4_HEIGHT_PX * 4,
      pageGap: 0,
      pageScale: 2,
      backgroundColor: "#ffffff",
    });
  });

  it("fits the live A4 preview inside the available panel width by default", () => {
    expect(calculateFitPreviewZoom(620)).toBe(72);
    expect(calculateFitPreviewZoom(240)).toBe(35);
    expect(calculateFitPreviewZoom(1200)).toBe(90);
  });
});
