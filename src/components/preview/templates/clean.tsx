'use client';

import type {
  Resume,
  PersonalInfoContent,
  SummaryContent,
  WorkExperienceContent,
  EducationContent,
  SkillsContent,
  ProjectsContent,
  CertificationsContent,
  LanguagesContent,
  CustomContent,
  GitHubContent,
} from '@/types/resume';
import { degreeField, isSectionEmpty, md } from '../utils';
import { AvatarImage } from '../avatar-image';
import { QrCodesPreview } from '../qr-codes-preview';

const BLUE = '#0066cc';
const TEAL = '#0d9488';

export function CleanTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          {pi.avatar && (
            <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={64} className="shrink-0" style={{ border: `2px solid ${BLUE}` }} />
          )}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BLUE }}>{pi.fullName || 'Your Name'}</h1>
            {pi.jobTitle && <p className="mt-0.5 text-base" style={{ color: TEAL }}>{pi.jobTitle}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-500">
          {pi.age && <span>{pi.age}</span>}
          {pi.politicalStatus && <span>{pi.politicalStatus}</span>}
          {pi.gender && <span>{pi.gender}</span>}
          {pi.ethnicity && <span>{pi.ethnicity}</span>}
          {pi.hometown && <span>{pi.hometown}</span>}
          {pi.maritalStatus && <span>{pi.maritalStatus}</span>}
          {pi.yearsOfExperience && <span>{pi.yearsOfExperience}</span>}
          {pi.educationLevel && <span>{pi.educationLevel}</span>}
          {pi.email && <span>{pi.email}</span>}
          {pi.phone && <span>{pi.phone}</span>}
          {pi.wechat && <span>{pi.wechat}</span>}
          {pi.location && <span>{pi.location}</span>}
          {pi.website && <span>{pi.website}</span>}
          {pi.linkedin && <span>LinkedIn: {pi.linkedin}</span>}
          {pi.github && <span>GitHub: {pi.github}</span>}
        </div>
        <div className="mt-3 h-0.5 w-full rounded" style={{ background: `linear-gradient(90deg, ${BLUE}, ${TEAL})` }} />
      </div>

      {/* Sections */}
      {resume.sections
        .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
        .map((section) => (
          <div key={section.id} className="mb-5" data-section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>{section.title}</h2>
            <CleanSectionContent section={section} resume={resume} />
          </div>
        ))}
    </div>
  );
}

function CleanSectionContent({ section, resume }: { section: any; resume: Resume }) {
  const content = section.content;
  if (!content) return null;

  if (section.type === 'summary') {
    return <p className="text-sm leading-relaxed text-zinc-600" dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />;
  }

  if (section.type === 'work_experience') {
    return (
      <div className="space-y-4">
        {(content.items || []).map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold text-zinc-800">{item.position}</span>
                {item.company && <span className="text-sm" style={{ color: TEAL }}> | {item.company}</span>}
                {item.location && <span className="text-sm text-zinc-400"> , {item.location}</span>}
              </div>
              <span className="shrink-0 text-xs text-zinc-400">{item.startDate} – {item.endDate || (item.current ? (resume.language === 'zh' ? '至今' : 'Present') : '')}</span>
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: TEAL, color: TEAL }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {item.highlights.map((h: string, i: number) => <li key={i} className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(h) }} />)}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'education') {
    return (
      <div className="space-y-3">
        {(content.items || []).map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold text-zinc-800">{degreeField(item.degree, item.field)}</span>
                {item.institution && <span className="text-sm text-zinc-500"> — {item.institution}</span>}
                {item.location && <span className="text-sm text-zinc-400"> , {item.location}</span>}
              </div>
              <span className="shrink-0 text-xs text-zinc-400">{item.startDate} – {item.endDate || (resume.language === 'zh' ? '至今' : 'Present')}</span>
            </div>
            {item.gpa && <p className="text-sm text-zinc-500">GPA: {item.gpa}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {item.highlights.map((h: string, i: number) => <li key={i} className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(h) }} />)}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'skills') {
    return (
      <div className="flex flex-wrap gap-2">
        {(content.categories || []).flatMap((cat: any) =>
          (cat.skills || []).map((skill: string, i: number) => (
            <span key={`${cat.id}-${i}`} className="rounded-full border px-3 py-0.5 text-xs font-medium" style={{ borderColor: TEAL, color: TEAL }}>
              {skill}
            </span>
          ))
        )}
      </div>
    );
  }

  if (section.type === 'projects') {
    const items = (content as ProjectsContent).items || [];
    return (
      <div className="space-y-4">
        {items.map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold" style={{ color: TEAL }}>{item.name}</span>
              {item.startDate && (
                <span className="shrink-0 text-xs text-zinc-400">
                  {item.startDate} – {item.endDate || (resume.language === 'zh' ? '至今' : 'Present')}
                </span>
              )}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: TEAL, color: TEAL }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {item.highlights.map((h: string, i: number) => <li key={i} className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(h) }} />)}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'certifications') {
    const items = (content as CertificationsContent).items || [];
    return (
      <div className="space-y-1.5">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-baseline justify-between text-sm">
            <div>
              <span className="font-semibold" style={{ color: BLUE }}>{item.name}</span>
              {item.issuer && <span className="text-zinc-600"> — {item.issuer}</span>}
            </div>
            {item.date && <span className="shrink-0 text-xs text-zinc-400">{item.date}</span>}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'languages') {
    const items = (content as LanguagesContent).items || [];
    return (
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {items.map((item: any) => (
          <span key={item.id} className="text-sm">
            <span className="font-semibold" style={{ color: BLUE }}>{item.language}</span>
            <span className="text-zinc-500"> — {item.proficiency}</span>
          </span>
        ))}
      </div>
    );
  }

  if (section.type === 'github') {
    const items = (content as GitHubContent).items || [];
    return (
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold" style={{ color: TEAL }}>{item.name}</span>
              <span className="text-xs text-zinc-400">{'\u2B50'} {item.stars?.toLocaleString()}</span>
            </div>
            {item.language && <span className="text-xs text-zinc-500">{item.language}</span>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'custom') {
    const items = (content as CustomContent).items || [];
    return (
      <div className="space-y-2">
        {items.map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-semibold" style={{ color: BLUE }}>{item.title}</span>
                {item.subtitle && <span className="text-sm text-zinc-500"> — {item.subtitle}</span>}
              </div>
              {item.date && <span className="shrink-0 text-xs text-zinc-400">{item.date}</span>}
            </div>
            {item.description && <p className="mt-0.5 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'qr_codes') {
    return <QrCodesPreview items={(content as any).items || []} />;
  }

  // Generic fallback
  if (content?.items) {
    return (
      <div className="space-y-2">
        {content.items.map((item: any) => (
          <div key={item.id}>
            <span className="text-sm font-medium text-zinc-700">{item.name || item.title || item.language}</span>
            {item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
