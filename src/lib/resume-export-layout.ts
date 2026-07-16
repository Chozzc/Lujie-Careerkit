export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

const PAGE_TOLERANCE_PX = 0;
const MIN_READABLE_SMART_ONE_PAGE_SCALE = 0.82;
const EXPORT_IMAGE_SCALE = 2;
const PREVIEW_PAGE_GUTTER_PX = 48;
const MIN_AUTO_PREVIEW_ZOOM = 35;
const MAX_AUTO_PREVIEW_ZOOM = 90;
const CONTINUATION_PAGE_TOP_INSET_PX = 32;
const MIN_BREAK_FILL_RATIO = 0.65;

export type ResumePreviewRenderMode = "standalone" | "paged" | "export";

export type ResumePageSlice = {
  sourceStart: number;
  sourceEnd: number;
  topInset: number;
};

export function calculateResumePagination(
  contentHeight: number,
  smartOnePage: boolean,
  breakCandidates: number[] = [],
) {
  const measuredHeight = Math.max(contentHeight, 1);
  const neededScale = measuredHeight > A4_HEIGHT_PX ? A4_HEIGHT_PX / measuredHeight : 1;
  const smartOnePageOverflow = Boolean(smartOnePage && neededScale < MIN_READABLE_SMART_ONE_PAGE_SCALE);
  const smartOnePageApplied = Boolean(smartOnePage && !smartOnePageOverflow);
  const fitScale = smartOnePageApplied && measuredHeight > A4_HEIGHT_PX
    ? Math.min(1, neededScale)
    : 1;
  const pageSlices = smartOnePageApplied
    ? [{ sourceStart: 0, sourceEnd: measuredHeight, topInset: 0 }]
    : calculatePageSlices(measuredHeight, breakCandidates);
  const pageCount = pageSlices.length;
  const horizontalOffset = fitScale < 1 ? (A4_WIDTH_PX * (1 - fitScale)) / 2 : 0;

  return {
    fitScale,
    pageCount,
    pageSlices,
    horizontalOffset,
    smartOnePageApplied,
    smartOnePageOverflow,
  };
}

function calculatePageSlices(contentHeight: number, breakCandidates: number[]): ResumePageSlice[] {
  if (contentHeight <= A4_HEIGHT_PX + PAGE_TOLERANCE_PX) {
    return [{ sourceStart: 0, sourceEnd: contentHeight, topInset: 0 }];
  }

  const candidates = [...new Set(
    breakCandidates
      .filter((value) => Number.isFinite(value) && value > 0 && value < contentHeight)
      .map((value) => Math.round(value * 100) / 100),
  )].sort((a, b) => a - b);
  const slices: ResumePageSlice[] = [];
  let sourceStart = 0;

  while (sourceStart < contentHeight - PAGE_TOLERANCE_PX) {
    const topInset = slices.length === 0 ? 0 : CONTINUATION_PAGE_TOP_INSET_PX;
    const sourceCapacity = A4_HEIGHT_PX - topInset;
    const targetEnd = sourceStart + sourceCapacity;

    if (targetEnd >= contentHeight - PAGE_TOLERANCE_PX) {
      slices.push({ sourceStart, sourceEnd: contentHeight, topInset });
      sourceStart = contentHeight;
      break;
    }

    const minimumUsefulBreak = sourceStart + sourceCapacity * MIN_BREAK_FILL_RATIO;
    const safeEnd = findLastCandidate(candidates, minimumUsefulBreak, targetEnd) ?? targetEnd;
    slices.push({ sourceStart, sourceEnd: safeEnd, topInset });
    sourceStart = safeEnd;
  }

  if (sourceStart < contentHeight) {
    slices.push({
      sourceStart,
      sourceEnd: contentHeight,
      topInset: slices.length === 0 ? 0 : CONTINUATION_PAGE_TOP_INSET_PX,
    });
  }

  return slices.length > 0
    ? slices
    : [{ sourceStart: 0, sourceEnd: contentHeight, topInset: 0 }];
}

function findLastCandidate(candidates: number[], minimum: number, maximum: number) {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate > maximum) continue;
    if (candidate >= minimum) return candidate;
    break;
  }
  return undefined;
}

/**
 * Finds vertical boundaries between rendered text/blocks. These coordinates let
 * the preview start the next page between lines instead of cutting a line in half.
 */
export function collectResumePageBreakCandidates(root: HTMLElement): number[] {
  const rootRect = root.getBoundingClientRect();
  const rootHeight = Math.max(root.scrollHeight, Math.ceil(rootRect.height), 1);
  const candidates: number[] = [];
  const textIntervals: Array<{ top: number; bottom: number }> = [];

  const addRect = (rect: DOMRect) => {
    const top = rect.top - rootRect.top;
    const bottom = rect.bottom - rootRect.top;
    if (bottom <= 0 || top >= rootHeight) return;
    textIntervals.push({ top: Math.max(0, top), bottom: Math.min(rootHeight, bottom) });
  };

  const nodeFilter = root.ownerDocument.defaultView?.NodeFilter;
  if (nodeFilter) {
    const walker = root.ownerDocument.createTreeWalker(root, nodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) {
        const range = root.ownerDocument.createRange();
        range.selectNodeContents(node);
        Array.from(range.getClientRects()).forEach(addRect);
        range.detach();
      }
      node = walker.nextNode();
    }
  }

  const isInsideText = (position: number) => textIntervals.some(
    ({ top, bottom }) => position > top + 1 && position < bottom - 1,
  );

  root.querySelectorAll<HTMLElement>("[data-section], [data-section] *").forEach((element) => {
    const style = root.ownerDocument.defaultView?.getComputedStyle(element);
    if (!style || style.display === "none" || style.position === "fixed" || style.position === "absolute") return;

    Array.from(element.getClientRects()).forEach((rect) => {
      const top = rect.top - rootRect.top;
      const bottom = rect.bottom - rootRect.top;
      if (top > 0 && top < rootHeight && !isInsideText(top)) candidates.push(top);
      if (bottom > 0 && bottom < rootHeight && !isInsideText(bottom)) candidates.push(bottom);
    });
  });

  const mergedTextIntervals = textIntervals
    .sort((a, b) => a.top - b.top)
    .reduce<Array<{ top: number; bottom: number }>>((merged, interval) => {
      const previous = merged.at(-1);
      if (!previous || interval.top > previous.bottom + 0.5) {
        merged.push({ ...interval });
      } else {
        previous.bottom = Math.max(previous.bottom, interval.bottom);
      }
      return merged;
    }, []);

  for (let index = 0; index < mergedTextIntervals.length - 1; index += 1) {
    const current = mergedTextIntervals[index];
    const next = mergedTextIntervals[index + 1];
    if (next.top > current.bottom) {
      candidates.push((current.bottom + next.top) / 2);
    }
  }

  return [...new Set(candidates.map((value) => Math.round(value * 2) / 2))]
    .sort((a, b) => a - b);
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
