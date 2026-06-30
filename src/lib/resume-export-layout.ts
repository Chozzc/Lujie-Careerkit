export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

const PAGE_TOLERANCE_PX = 24;
const MIN_READABLE_SMART_ONE_PAGE_SCALE = 0.82;
const EXPORT_IMAGE_SCALE = 2;
const PREVIEW_PAGE_GUTTER_PX = 48;
const MIN_AUTO_PREVIEW_ZOOM = 35;
const MAX_AUTO_PREVIEW_ZOOM = 90;

export type ResumePreviewRenderMode = "standalone" | "paged" | "export";

export function calculateResumePagination(contentHeight: number, smartOnePage: boolean) {
  const measuredHeight = Math.max(contentHeight, 1);
  const neededScale = measuredHeight > A4_HEIGHT_PX ? A4_HEIGHT_PX / measuredHeight : 1;
  const smartOnePageOverflow = Boolean(smartOnePage && neededScale < MIN_READABLE_SMART_ONE_PAGE_SCALE);
  const smartOnePageApplied = Boolean(smartOnePage && !smartOnePageOverflow);
  const fitScale = smartOnePageApplied && measuredHeight > A4_HEIGHT_PX
    ? Math.min(1, neededScale)
    : 1;
  const effectiveHeight = measuredHeight * fitScale;
  const pageCount = smartOnePageApplied
    ? 1
    : Math.max(1, Math.ceil(Math.max(0, effectiveHeight - PAGE_TOLERANCE_PX) / A4_HEIGHT_PX));
  const horizontalOffset = fitScale < 1 ? (A4_WIDTH_PX * (1 - fitScale)) / 2 : 0;

  return { fitScale, pageCount, horizontalOffset, smartOnePageApplied, smartOnePageOverflow };
}

export function buildPagedResumeModeCSS(scopeSelector: string) {
  return `
    ${scopeSelector}[data-resume-render-mode="paged"],
    ${scopeSelector}[data-resume-render-mode="export"] {
      width: 100%;
      min-height: ${A4_HEIGHT_PX}px;
      background: #ffffff;
    }
    ${scopeSelector}[data-resume-render-mode="paged"] > div,
    ${scopeSelector}[data-resume-render-mode="export"] > div {
      width: 100% !important;
      max-width: none !important;
      min-height: ${A4_HEIGHT_PX}px !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
  `;
}

export function getCombinedPageImageLayout(pageCount: number) {
  const normalizedPageCount = Math.max(1, Math.floor(pageCount));

  return {
    width: A4_WIDTH_PX * EXPORT_IMAGE_SCALE,
    height: normalizedPageCount * A4_HEIGHT_PX * EXPORT_IMAGE_SCALE,
    pageGap: 0,
    pageScale: EXPORT_IMAGE_SCALE,
    backgroundColor: "#ffffff",
  };
}

export function calculateFitPreviewZoom(containerWidth: number) {
  const availableWidth = Math.max(0, containerWidth - PREVIEW_PAGE_GUTTER_PX);
  const zoom = Math.floor((availableWidth / A4_WIDTH_PX) * 100);
  return Math.max(MIN_AUTO_PREVIEW_ZOOM, Math.min(MAX_AUTO_PREVIEW_ZOOM, zoom));
}
