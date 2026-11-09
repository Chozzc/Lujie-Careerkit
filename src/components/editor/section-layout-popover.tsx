'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { getInlineLayoutFields, getResumeBoldFields } from '@/lib/resume-inline-layout';
import type { ResumeSection, SectionContent } from '@/types/resume';

export function SectionLayoutPopover({ section, onUpdate }: {
  section: ResumeSection;
  onUpdate: (content: Partial<SectionContent>) => void;
}) {
  const t = useTranslations('editor');
  const radioGroup = useId();
  const compact = section.content.inlineLayout === true;
  const fields = getInlineLayoutFields(section);
  const boldFields = getResumeBoldFields(section);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="sm" className="gap-0.5 px-1.5 text-xs" />}
        aria-label={t('sectionLayoutFor', { section: section.title })}
      >
        {t(compact ? 'inlineLayout' : 'templateLayout')}
        <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[min(26rem,var(--available-height))] max-w-[calc(100vw-1rem)] gap-3 overflow-y-auto overscroll-contain p-3">
        <PopoverHeader>
          <PopoverTitle className="break-words">{t('sectionLayoutFor', { section: section.title })}</PopoverTitle>
          <PopoverDescription className="text-xs">{t('sectionLayoutScope')}</PopoverDescription>
        </PopoverHeader>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-xs font-medium">{t('sectionLayoutMode')}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {[false, true].map((value) => (
              <label key={String(value)} className="min-w-0 cursor-pointer">
                <input
                  type="radio"
                  className="peer sr-only"
                  name={radioGroup}
                  checked={compact === value}
                  onChange={() => onUpdate({ inlineLayout: value })}
                />
                <span className="flex min-h-8 items-center justify-center rounded px-1 text-center text-xs text-muted-foreground peer-checked:bg-popover peer-checked:font-medium peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                  {t(value ? 'inlineLayout' : 'templateLayout')}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-xs font-medium">{t('inlineBoldFields')}</legend>
          {fields.length ? (
            <div className="grid grid-cols-2 gap-x-2">
              {fields.map((field) => (
                <label key={field} className="flex min-h-8 cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={boldFields.includes(field)}
                    onChange={(event) => onUpdate({
                      inlineBoldFields: event.currentTarget.checked ? [...boldFields, field] : boldFields.filter((value) => value !== field),
                    })}
                  />
                  {t(`inlineFields.${field}`)}
                </label>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">{t('inlineFieldsEmpty')}</p>}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
