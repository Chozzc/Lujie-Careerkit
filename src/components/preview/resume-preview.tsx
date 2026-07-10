'use client';

import { useId } from 'react';
import type { Resume, ThemeConfig } from '@/types/resume';
import { BACKGROUND_TEMPLATES } from '@/lib/constants';
import { buildPagedResumeModeCSS, type ResumePreviewRenderMode } from '@/lib/resume-export-layout';
import { ClassicTemplate } from './templates/classic';
import { ModernTemplate } from './templates/modern';
import { MinimalTemplate } from './templates/minimal';
import { ProfessionalTemplate } from './templates/professional';
import { TwoColumnTemplate } from './templates/two-column';
import { CreativeTemplate } from './templates/creative';
import { AtsTemplate } from './templates/ats';
import { AcademicTemplate } from './templates/academic';
import { ElegantTemplate } from './templates/elegant';
import { ExecutiveTemplate } from './templates/executive';
import { DeveloperTemplate } from './templates/developer';
import { DesignerTemplate } from './templates/designer';
import { StartupTemplate } from './templates/startup';
import { FormalTemplate } from './templates/formal';
import { InfographicTemplate } from './templates/infographic';
import { CompactTemplate } from './templates/compact';
import { EuroTemplate } from './templates/euro';
import { CleanTemplate } from './templates/clean';
import { BoldTemplate } from './templates/bold';
import { TimelineTemplate } from './templates/timeline';
// Batch 1: Industry/Professional
import { NordicTemplate } from './templates/nordic';
import { CorporateTemplate } from './templates/corporate';
import { ConsultantTemplate } from './templates/consultant';
import { FinanceTemplate } from './templates/finance';
import { MedicalTemplate } from './templates/medical';
// Batch 2: Modern/Tech
import { GradientTemplate } from './templates/gradient';
import { MetroTemplate } from './templates/metro';
import { MaterialTemplate } from './templates/material';
import { CoderTemplate } from './templates/coder';
import { BlocksTemplate } from './templates/blocks';
// Batch 3: Creative/Artistic
import { MagazineTemplate } from './templates/magazine';
import { ArtisticTemplate } from './templates/artistic';
import { RetroTemplate } from './templates/retro';
import { NeonTemplate } from './templates/neon';
import { WatercolorTemplate } from './templates/watercolor';
// Batch 4: Style/Culture
import { SwissTemplate } from './templates/swiss';
import { JapaneseTemplate } from './templates/japanese';
import { BerlinTemplate } from './templates/berlin';
import { LuxeTemplate } from './templates/luxe';
import { RoseTemplate } from './templates/rose';
// Batch 5: Specialized
import { ArchitectTemplate } from './templates/architect';
import { LegalTemplate } from './templates/legal';
import { TeacherTemplate } from './templates/teacher';
import { ScientistTemplate } from './templates/scientist';
import { EngineerTemplate } from './templates/engineer';
// Batch 6: Layout Variants
import { SidebarTemplate } from './templates/sidebar';
import { CardTemplate } from './templates/card';
import { ZigzagTemplate } from './templates/zigzag';
import { RibbonTemplate } from './templates/ribbon';
import { MosaicTemplate } from './templates/mosaic';

interface ResumePreviewProps {
  resume: Resume;
  mode?: ResumePreviewRenderMode;
}

const templateMap: Record<string, React.ComponentType<{ resume: Resume }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  professional: ProfessionalTemplate,
  'two-column': TwoColumnTemplate,
  creative: CreativeTemplate,
  ats: AtsTemplate,
  academic: AcademicTemplate,
  elegant: ElegantTemplate,
  executive: ExecutiveTemplate,
  developer: DeveloperTemplate,
  designer: DesignerTemplate,
  startup: StartupTemplate,
  formal: FormalTemplate,
  infographic: InfographicTemplate,
  compact: CompactTemplate,
  euro: EuroTemplate,
  clean: CleanTemplate,
  bold: BoldTemplate,
  timeline: TimelineTemplate,
  // Batch 1
  nordic: NordicTemplate,
  corporate: CorporateTemplate,
  consultant: ConsultantTemplate,
  finance: FinanceTemplate,
  medical: MedicalTemplate,
  // Batch 2
  gradient: GradientTemplate,
  metro: MetroTemplate,
  material: MaterialTemplate,
  coder: CoderTemplate,
  blocks: BlocksTemplate,
  // Batch 3
  magazine: MagazineTemplate,
  artistic: ArtisticTemplate,
  retro: RetroTemplate,
  neon: NeonTemplate,
  watercolor: WatercolorTemplate,
  // Batch 4
  swiss: SwissTemplate,
  japanese: JapaneseTemplate,
  berlin: BerlinTemplate,
  luxe: LuxeTemplate,
  rose: RoseTemplate,
  // Batch 5
  architect: ArchitectTemplate,
  legal: LegalTemplate,
  teacher: TeacherTemplate,
  scientist: ScientistTemplate,
  engineer: EngineerTemplate,
  // Batch 6
  sidebar: SidebarTemplate,
  card: CardTemplate,
  zigzag: ZigzagTemplate,
  ribbon: RibbonTemplate,
  mosaic: MosaicTemplate,
};

const FONT_SIZE_SCALE: Record<string, { body: string; h1: string; h2: string; h3: string }> = {
  small:  { body: '12px', h1: '22px', h2: '15px', h3: '13px' },
  medium: { body: '14px', h1: '26px', h2: '17px', h3: '15px' },
  large:  { body: '16px', h1: '30px', h2: '19px', h3: '17px' },
};

const LOGO_SIZE_SCALE: Record<string, { container: string; icon: string }> = {
  small: { container: '20px', icon: '12px' },
  medium: { container: '28px', icon: '16px' },
  large: { container: '36px', icon: '20px' },
};

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  fontSize: 'medium',
  logoSize: 'medium',
  lineSpacing: 1.5,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  sectionSpacing: 16,
  avatarStyle: 'oneInch',
};

/** Returns true if a hex colour is dark (luminance < 0.4) */
function isDark(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 0.4;
}

function buildThemeCSS(scopeId: string, theme: ThemeConfig, template: string): string {
  const s = `[data-theme-scope="${scopeId}"]`;
  const fs = FONT_SIZE_SCALE[theme.fontSize] || FONT_SIZE_SCALE.medium;
  const logo = LOGO_SIZE_SCALE[theme.logoSize ?? 'medium'] || LOGO_SIZE_SCALE.medium;
  const m = theme.margin;
  const needsPadding = !BACKGROUND_TEMPLATES.has(template);
  const primaryIsDark = isDark(theme.primaryColor);
  return `
    ${s} > div {
      font-family: ${theme.fontFamily}, 'Noto Sans SC', sans-serif !important;
      line-height: ${theme.lineSpacing} !important;
      ${needsPadding ? `padding-top: ${m.top}px !important; padding-right: ${m.right}px !important; padding-bottom: ${m.bottom}px !important; padding-left: ${m.left}px !important;` : ''}
      --base-body-size: ${fs.body};
      --base-h1-size: ${fs.h1};
      --base-h2-size: ${fs.h2};
      --base-h3-size: ${fs.h3};
      --base-line-spacing: ${theme.lineSpacing};
      --base-section-spacing: ${theme.sectionSpacing}px;
      --base-margin-top: ${m.top}px;
      --base-margin-right: ${m.right}px;
      --base-margin-bottom: ${m.bottom}px;
      --base-margin-left: ${m.left}px;
    }
    ${s} p, ${s} li, ${s} span, ${s} td, ${s} a, ${s} div {
      font-size: ${fs.body} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} [data-entry-logo] {
      width: ${logo.container} !important;
      height: ${logo.container} !important;
    }
    ${s} [data-entry-logo] svg {
      width: ${logo.icon} !important;
      height: ${logo.icon} !important;
    }
    ${s} h1 {
      color: ${theme.primaryColor} !important;
      font-size: ${fs.h1} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} h2 {
      color: ${theme.primaryColor} !important;
      font-size: ${fs.h2} !important;
      line-height: ${theme.lineSpacing} !important;
      border-color: ${theme.accentColor} !important;
    }
    ${s} h3 {
      color: ${theme.primaryColor} !important;
      font-size: ${fs.h3} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${s} a, ${s} strong {
      color: ${theme.accentColor} !important;
    }
    ${s} [class*="border-b-2"],
    ${s} [class*="border-b-"],
    ${s} [style*="border"] {
      border-color: ${theme.accentColor} !important;
    }
    ${s} [class*="bg-blue-"], ${s} [class*="bg-indigo-"],
    ${s} [class*="bg-slate-800"], ${s} [class*="bg-zinc-800"],
    ${s} [class*="bg-teal-"], ${s} [class*="bg-emerald-"], ${s} [class*="bg-green-"],
    ${s} [style*="background: linear-gradient"] {
      background-color: ${theme.accentColor} !important;
      background: linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.accentColor} 100%) !important;
    }
    ${s} [class*="text-teal-"], ${s} [class*="text-emerald-"], ${s} [class*="text-green-"] {
      color: ${theme.accentColor} !important;
    }
    ${s} [data-section] {
      ${needsPadding ? `margin-bottom: ${theme.sectionSpacing}px !important;` : `padding-bottom: ${theme.sectionSpacing}px !important;`}
    }
    ${primaryIsDark ? `
    ${s} [style*="background"][style*="#"] h1:not([style*="color"]),
    ${s} [style*="background"][style*="#"] h2:not([style*="color"]),
    ${s} [style*="background"][style*="#"] h3:not([style*="color"]),
    ${s} [style*="background"][style*="rgb"] h1:not([style*="color"]),
    ${s} [style*="background"][style*="rgb"] h2:not([style*="color"]),
    ${s} [style*="background"][style*="rgb"] h3:not([style*="color"]),
    ${s} [style*="background"][style*="linear-gradient"] h1:not([style*="color"]),
    ${s} [style*="background"][style*="linear-gradient"] h2:not([style*="color"]),
    ${s} [style*="background"][style*="linear-gradient"] h3:not([style*="color"]),
    ${s} .bg-black h1:not([style*="color"]),
    ${s} .bg-black h2:not([style*="color"]),
    ${s} .bg-black h3:not([style*="color"]) {
      color: #ffffff !important;
    }` : ''}
    ${buildPagedResumeModeCSS(s)}
  `;
}

export function ResumePreview({ resume, mode = "standalone" }: ResumePreviewProps) {
  const Template = templateMap[resume.template] || ClassicTemplate;
  const scopeId = useId();
  const theme: ThemeConfig = { ...DEFAULT_THEME, ...(resume.themeConfig || {}) };

  // Defensive: ensure resume.sections is always an array (AI may return invalid/empty data)
  const safeResume = resume.sections
    ? { ...resume, sections: normalizePreviewSections(resume.sections) }
    : { ...resume, sections: [] };

  return (
    <>
      {/* Load the same Google Fonts used in PDF/HTML export so preview renders
          with identical font metrics (Inter for Latin, Noto Sans SC for CJK). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <div data-theme-scope={scopeId} data-resume-render-mode={mode}>
        <style dangerouslySetInnerHTML={{ __html: buildThemeCSS(scopeId, theme, safeResume.template) }} />
        <Template resume={safeResume} />
      </div>
    </>
  );
}

function normalizePreviewSections(sections: Resume["sections"]) {
  return sections.map((section) => {
    if (section.type === 'internship_experience') {
      return { ...section, type: 'work_experience' };
    }
    if (section.type === 'self_evaluation') {
      return { ...section, type: 'summary' };
    }
    return section;
  });
}
