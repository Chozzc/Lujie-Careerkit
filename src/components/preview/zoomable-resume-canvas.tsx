"use client";

import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Move, Plus, RotateCcw } from "lucide-react";

import { PagedResumePreview } from "@/components/preview/paged-resume-preview";
import { cn } from "@/lib/utils";
import type { Resume } from "@/types/resume";

type CanvasPoint = {
  x: number;
  y: number;
};

type ZoomableResumeCanvasProps = {
  resume: Resume;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  smartOnePage: boolean;
  previewRootRef?: RefObject<HTMLDivElement | null>;
  initialZoom?: number;
  initialPan?: CanvasPoint;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  className?: string;
};

const defaultPan = { x: 48, y: 28 };

export function ZoomableResumeCanvas({
  resume,
  zoom,
  onZoomChange,
  smartOnePage,
  previewRootRef,
  initialZoom = 70,
  initialPan = defaultPan,
  minZoom = 30,
  maxZoom = 160,
  zoomStep = 5,
  className,
}: ZoomableResumeCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState(initialPan);
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    startPan: initialPan,
  });

  useEffect(() => {
    if (!isPanning) return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      setPan({
        x: drag.startPan.x + event.clientX - drag.startX,
        y: drag.startPan.y + event.clientY - drag.startY,
      });
    };
    const handleMouseUp = () => {
      setIsPanning(false);
    };

    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  const updateZoom = useCallback(
    (nextZoom: number, focus?: CanvasPoint) => {
      const clampedZoom = clampNumber(nextZoom, minZoom, maxZoom);
      if (clampedZoom === zoom) return;

      if (focus) {
        const ratio = clampedZoom / zoom;
        setPan((current) => ({
          x: focus.x - (focus.x - current.x) * ratio,
          y: focus.y - (focus.y - current.y) * ratio,
        }));
      }

      onZoomChange(clampedZoom);
    },
    [maxZoom, minZoom, onZoomChange, zoom],
  );

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      updateZoom(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, [updateZoom, zoom, zoomStep]);

  function handleCanvasMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target instanceof Element && event.target.closest("button, input")) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan,
    };
    setIsPanning(true);
  }

  function resetView() {
    setPan(initialPan);
    onZoomChange(initialZoom);
  }

  return (
    <div
      ref={canvasRef}
      className={cn(
        "relative h-full min-h-0 touch-none overflow-hidden overscroll-contain bg-[#f8fafc]",
        isPanning ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(100,116,139,0.2) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
      title="滚轮缩放，左键/中键拖动画布"
      onMouseDown={handleCanvasMouseDown}
      onAuxClick={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
    >
      <div className="absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-md border border-line bg-white/95 p-0.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
        <button
          type="button"
          aria-label="缩小画布"
          title="缩小画布"
          disabled={zoom <= minZoom}
          onClick={() => updateZoom(zoom - zoomStep)}
          className="grid h-6 w-6 place-items-center rounded text-foreground hover:bg-surface-low disabled:cursor-not-allowed disabled:text-muted-foreground/50"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          aria-label="画布缩放比例"
          title="画布缩放比例"
          type="range"
          min={minZoom}
          max={maxZoom}
          step={zoomStep}
          value={zoom}
          onChange={(event) => updateZoom(Number(event.currentTarget.value))}
          className="h-6 w-20 accent-primary"
        />
        <button
          type="button"
          aria-label="放大画布"
          title="放大画布"
          disabled={zoom >= maxZoom}
          onClick={() => updateZoom(zoom + zoomStep)}
          className="grid h-6 w-6 place-items-center rounded text-foreground hover:bg-surface-low disabled:cursor-not-allowed disabled:text-muted-foreground/50"
        >
          <Plus className="h-3 w-3" />
        </button>
        <span className="w-10 text-center text-[0.6875rem] font-medium text-muted-foreground">{zoom}%</span>
        <button
          type="button"
          aria-label="重置画布视图"
          title="重置画布视图"
          onClick={resetView}
          className="grid h-6 w-6 place-items-center rounded text-foreground hover:bg-surface-low"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-lg border border-line bg-white/90 px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground shadow-sm backdrop-blur">
        <Move className="h-3.5 w-3.5" />
        滚轮缩放 · 左键/中键拖动画布
      </div>

      <div
        ref={previewRootRef}
        className="absolute left-0 top-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
        }}
      >
        <PagedResumePreview resume={resume} zoom={zoom} smartOnePage={smartOnePage} />
      </div>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
