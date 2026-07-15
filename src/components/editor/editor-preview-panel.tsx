'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ZoomableResumeCanvas } from '@/components/preview/zoomable-resume-canvas';
import { calculateFitPreviewZoom } from '@/lib/resume-export-layout';
import { readSmartOnePagePreference, writeSmartOnePagePreference } from '@/lib/resume-preferences';
import { useResumeStore } from '@/stores/resume-store';
import type { Resume } from '@/types/resume';

export function EditorPreviewPanel() {
  const t = useTranslations('editor.toolbar');
  const { currentResume, sections } = useResumeStore();
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(70);
  const [manualZoom, setManualZoom] = useState(false);
  const [smartOnePage, setSmartOnePage] = useState(false);

  const liveResume = useMemo<Resume | null>(() => {
    if (!currentResume) return null;
    return { ...currentResume, sections };
  }, [currentResume, sections]);

  useEffect(() => {
    setSmartOnePage(readSmartOnePagePreference());
  }, []);

  useEffect(() => {
    if (manualZoom) return;
    const node = previewBodyRef.current;
    if (!node) return;

    let frame = 0;
    const updateZoom = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setZoom(calculateFitPreviewZoom(node.clientWidth));
      });
    };

    updateZoom();
    const observer = new ResizeObserver(updateZoom);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [manualZoom]);

  if (!liveResume) return null;

  function handleZoom(delta: number) {
    setManualZoom(true);
    setZoom((value) => Math.max(30, Math.min(150, value + delta)));
  }

  function handleCanvasZoom(nextZoom: number) {
    setManualZoom(true);
    setZoom(nextZoom);
  }

  function toggleSmartOnePage() {
    setSmartOnePage((value) => {
      writeSmartOnePagePreference(!value);
      return !value;
    });
  }

  return (
    <div data-tour="preview" className="flex h-full min-w-0 flex-col border-l bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800">
      {/* Header */}
      <div className="hidden shrink-0 items-center justify-between border-b bg-white px-4 py-2 md:flex dark:bg-background dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">{t('preview')}</span>
          <Button
            variant={smartOnePage ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            aria-label={t('smartOnePage')}
            title={t('smartOnePage')}
            onClick={toggleSmartOnePage}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('smartOnePage')}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            aria-label={t('zoomOut')}
            title={t('zoomOut')}
            onClick={() => handleZoom(-10)}
            disabled={zoom <= 30}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center text-xs text-zinc-500">{zoom}%</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            aria-label={t('zoomIn')}
            title={t('zoomIn')}
            onClick={() => handleZoom(10)}
            disabled={zoom >= 150}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview body */}
      <div ref={previewBodyRef} className="min-h-0 flex-1">
        <ZoomableResumeCanvas
          resume={liveResume}
          zoom={zoom}
          onZoomChange={handleCanvasZoom}
          smartOnePage={smartOnePage}
          initialZoom={70}
          minZoom={30}
          maxZoom={160}
        />
      </div>
    </div>
  );
}
