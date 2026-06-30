'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/stores/editor-store';
import { useResumeStore } from '@/stores/resume-store';
import { useDragHandle } from './dnd/sortable-section';
import type { ResumeSection, SectionContent } from '@/types/resume';
import { PersonalInfoSection } from './sections/personal-info';
import { SummarySection } from './sections/summary';
import { WorkExperienceSection } from './sections/work-experience';
import { EducationSection } from './sections/education';
import { SkillsSection } from './sections/skills';
import { ProjectsSection } from './sections/projects';
import { CertificationsSection } from './sections/certifications';
import { LanguagesSection } from './sections/languages';
import { CustomSection } from './sections/custom-section';
import { GitHubSection } from './sections/github';
import { QrCodesSection } from './sections/qr-codes';

interface SectionWrapperProps {
  section: ResumeSection;
  onUpdate: (content: Partial<SectionContent>) => void;
  onRemove: () => void;
}

const sectionComponents: Record<string, React.ComponentType<{ section: ResumeSection; onUpdate: (content: any) => void }>> = {
  personal_info: PersonalInfoSection,
  summary: SummarySection,
  work_experience: WorkExperienceSection,
  internship_experience: WorkExperienceSection,
  education: EducationSection,
  skills: SkillsSection,
  projects: ProjectsSection,
  certifications: CertificationsSection,
  self_evaluation: SummarySection,
  languages: LanguagesSection,
  github: GitHubSection,
  qr_codes: QrCodesSection,
  custom: CustomSection,
};

export function SectionWrapper({ section, onUpdate, onRemove }: SectionWrapperProps) {
  const t = useTranslations('editor');
  const { selectedSectionId, selectSection } = useEditorStore();
  const { toggleSectionVisibility, updateSectionTitle } = useResumeStore();
  const { attributes, listeners } = useDragHandle();
  const isSelected = selectedSectionId === section.id;
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(section.title);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== section.title) {
      updateSectionTitle(section.id, trimmed);
    } else {
      setRenameValue(section.title);
    }
    setIsRenaming(false);
  };

  const SectionComponent = sectionComponents[section.type];
  const isRenamable = section.type !== 'personal_info';

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-all duration-200 dark:bg-zinc-900 ${
        isSelected ? 'border-brand shadow-brand-muted/50 dark:shadow-brand/20' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
      } ${!section.visible ? 'opacity-50' : ''}`}
      onClick={() => selectSection(section.id)}
    >
      <div className="flex flex-row items-center justify-between border-b border-zinc-100 px-3 py-2.5 md:px-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <GripVertical
            className="h-4 w-4 cursor-grab text-zinc-300 active:cursor-grabbing"
            aria-label={`${section.title} 拖拽排序`}
            {...attributes}
            {...listeners}
          />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setRenameValue(section.title); setIsRenaming(false); }
              }}
              className="h-6 w-32 rounded border border-brand bg-transparent px-1 text-sm font-semibold text-zinc-700 outline-none dark:text-zinc-200"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3
              className={`text-sm font-semibold text-zinc-700 dark:text-zinc-200 ${isRenamable ? 'cursor-text rounded px-1 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-700' : ''}`}
              onDoubleClick={isRenamable ? (e) => { e.stopPropagation(); setRenameValue(section.title); setIsRenaming(true); } : undefined}
            >
              {section.title}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0"
            aria-label={section.visible ? `隐藏${section.title}` : `显示${section.title}`}
            title={section.visible ? `隐藏${section.title}` : `显示${section.title}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSectionVisibility(section.id);
            }}
          >
            {section.visible ? (
              <Eye className="h-3.5 w-3.5 text-zinc-400" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 cursor-pointer p-0 text-zinc-400 hover:text-red-500"
            aria-label={`删除${section.title}`}
            title={`删除${section.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        {!section.content || typeof section.content !== 'object' ? (
          <p className="text-sm text-red-400">{t('invalidSectionContent')}</p>
        ) : SectionComponent ? (
          <SectionComponent section={section} onUpdate={onUpdate} />
        ) : (
          <p className="text-sm text-zinc-400">未知模块类型：{section.type}</p>
        )}
      </div>
    </div>
  );
}
