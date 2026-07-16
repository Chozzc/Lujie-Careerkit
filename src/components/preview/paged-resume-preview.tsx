"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { ResumePreview } from "@/components/preview/resume-preview";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  calculateResumePagination,
  collectResumePageBreakCandidates,
} from "@/lib/resume-export-layout";
import type { Resume } from "@/types/resume";

type PagedResumePreviewProps = {
  resume: Resume;
  zoom: number;
  smartOnePage: boolean;
};

export function PagedResumePreview({ resume, zoom, smartOnePage }: PagedResumePreviewProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(A4_HEIGHT_PX);
  const [breakCandidates, setBreakCandidates] = useState<number[]>([]);

  useLayoutEffect(() => {
    const measure = () => {
      const node = measureRef.current;
      if (!node) return;
      setContentHeight(Math.max(node.scrollHeight, Math.ceil(node.getBoundingClientRect().height), 1));
      setBreakCandidates(collectResumePageBreakCandidates(node));
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (measureRef.current) observer.observe(measureRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [resume]);

  const pagination = useMemo(() => {
    return calculateResumePagination(contentHeight, smartOnePage, breakCandidates);
  }, [breakCandidates, contentHeight, smartOnePage]);

  const previewScale = zoom / 100;

  return (
    <div className="relative flex min-h-full justify-center p-3 md:p-5">
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 -z-10"
        style={{ width: A4_WIDTH_PX }}
      >
        <ResumePreview resume={resume} mode="paged" />
      </div>

      <div className="flex flex-col items-center gap-7">
        {pagination.smartOnePageOverflow && (
          <div className="max-w-[520px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs leading-5 text-amber-800">
            当前内容超过智能一页的可读范围，已保持分页预览。请删减或精简文字后再使用智能一页。
          </div>
        )}
        {pagination.pageSlices.map((pageSlice, pageIndex) => (
          <div key={pageIndex} className="flex flex-col items-center gap-2">
            <div
              className="origin-top-left"
              style={{
                width: A4_WIDTH_PX * previewScale,
                height: A4_HEIGHT_PX * previewScale,
              }}
            >
              <div
                className="relative overflow-hidden bg-white shadow-[0_16px_52px_rgba(15,23,42,0.16)] ring-1 ring-zinc-200"
                style={{
                  width: A4_WIDTH_PX,
                  height: A4_HEIGHT_PX,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  className="absolute left-0 overflow-hidden"
                  style={{
                    width: A4_WIDTH_PX,
                    top: pageSlice.topInset,
                    height: Math.min(
                      A4_HEIGHT_PX - pageSlice.topInset,
                      (pageSlice.sourceEnd - pageSlice.sourceStart) * pagination.fitScale,
                    ),
                  }}
                >
                  <div
                    className="absolute top-0"
                    style={{
                      width: A4_WIDTH_PX,
                      left: pagination.horizontalOffset,
                      transform: `scale(${pagination.fitScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <div style={{ marginTop: -pageSlice.sourceStart }}>
                      <ResumePreview resume={resume} mode="paged" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] text-zinc-500 shadow-sm ring-1 ring-zinc-200">
              <span>
                第 {pageIndex + 1} / {pagination.pageCount} 页
              </span>
              {pagination.smartOnePageApplied && pagination.fitScale < 1 && (
                <span>智能一页 {Math.round(pagination.fitScale * 100)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
