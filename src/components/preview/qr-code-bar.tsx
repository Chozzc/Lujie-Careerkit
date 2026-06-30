'use client';

import { useEffect, useState } from 'react';
import type { Resume, QrCodesContent } from '@/types/resume';
import { generateQrSvg } from '@/lib/qrcode';
import { TWO_COLUMN_TEMPLATES } from '@/lib/constants';

interface QrCodeBarProps {
  resume: Resume;
  template: string;
}

export function QrCodeBar({ resume, template }: QrCodeBarProps) {
  const qrSection = resume.sections.find((s) => s.type === 'qr_codes');
  if (!qrSection || !qrSection.visible) return null;

  const items = ((qrSection.content as QrCodesContent).items || []).filter((q) => q.url.trim());

  const [svgs, setSvgs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (items.length === 0) {
      setSvgs({});
      return;
    }
    let cancelled = false;
    (async () => {
      const results: Record<string, string> = {};
      for (const qr of items) {
        try {
          results[qr.id] = await generateQrSvg(qr.url, 80);
        } catch {
          // skip invalid URLs
        }
      }
      if (!cancelled) setSvgs(results);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items)]);

  if (items.length === 0) return null;

  const hasAnySvg = items.some((qr) => svgs[qr.id]);
  if (!hasAnySvg) return null;

  const sidebarInfo = TWO_COLUMN_TEMPLATES[template];

  return (
    <div
      style={{
        breakInside: 'avoid',
        ...(sidebarInfo
          ? { background: `linear-gradient(90deg, ${sidebarInfo.bg} ${sidebarInfo.width}, #ffffff ${sidebarInfo.width})` }
          : { background: '#ffffff' }),
      }}
    >
      {/* Section heading — theme CSS applies primaryColor, accentColor, fontSize */}
      <div
        data-section
        style={sidebarInfo ? { marginLeft: sidebarInfo.width, padding: '0 20px' } : { padding: '0 20px' }}
      >
        <h2 className="mb-3 border-b-2 pb-1 text-sm font-bold uppercase tracking-wider">
          {qrSection.title}
        </h2>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          padding: '0 20px 16px',
          ...(sidebarInfo ? { paddingLeft: `calc(${sidebarInfo.width} + 20px)` } : {}),
        }}
      >
        {items.map((qr) => {
          const svg = svgs[qr.id];
          if (!svg) return null;
          return (
            <div key={qr.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div
                style={{ width: 80, height: 80 }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              {qr.label && (
                <span style={{ fontSize: '10px', color: '#6b7280', lineHeight: 1.2 }}>{qr.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
