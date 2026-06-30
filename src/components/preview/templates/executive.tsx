'use client';

import type { Resume, PersonalInfoContent, SummaryContent, WorkExperienceContent, EducationContent, SkillsContent, ProjectsContent, CertificationsContent, LanguagesContent, GitHubContent, CustomContent } from '@/types/resume';
import { degreeField, isSectionEmpty, md } from '../utils';
import { AvatarImage } from '../avatar-image';
import { QrCodesPreview } from '../qr-codes-preview';

const CHARCOAL = '#2d3436';
const EMERALD = '#00b894';

export function ExecutiveTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-8 py-8" style={{ background: CHARCOAL }}>
        <div className="flex items-center gap-6">
          {pi.avatar && (
            <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={80} className="shrink-0" style={{ border: `2px solid ${EMERALD}` }} />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-white">{pi.fullName || 'Your Name'}</h1>
            {pi.jobTitle && <p className="mt-1 text-base font-light" style={{ color: EMERALD }}>{pi.jobTitle}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-400">
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
              {pi.linkedin && <span className="break-all">{pi.linkedin}</span>}
              {pi.github && <span className="break-all">{pi.github}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <div key={section.id} className="mb-6" data-section>
              <h2 className="mb-3 border-b-2 pb-1 text-sm font-bold uppercase tracking-wider" style={{ color: CHARCOAL, borderColor: EMERALD }}>
                {section.title}
              </h2>
              <ExecutiveSectionContent section={section} resume={resume} />
            </div>
          ))}
      </div>
    </div>
  );
}

function ExecutiveSectionContent({ section, resume }: { section: any; resume: Resume }) {
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
                <span className="text-sm font-bold" style={{ color: CHARCOAL }}>{item.position}</span>
                {item.company && <span className="text-sm text-zinc-600"> | {item.company}</span>}
              </div>
              <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: EMERALD }}>
                {item.startDate} – {item.endDate || (item.current ? (resume.language === 'zh' ? '至今' : 'Present') : '')}
              </span>
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && <p className="mt-0.5 text-xs text-zinc-400">{resume.language === 'zh' ? '技术栈' : 'Tech'}: {item.technologies.join(', ')}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
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
                <span className="text-sm font-bold" style={{ color: CHARCOAL }}>{degreeField(item.degree, item.field)}</span>
                {item.institution && <span className="text-sm text-zinc-600"> — {item.institution}</span>}
              </div>
              <span className="shrink-0 text-xs text-zinc-400">{item.startDate} – {item.endDate || (resume.language === 'zh' ? '至今' : 'Present')}</span>
            </div>
            {item.gpa && <p className="text-sm text-zinc-500">GPA: {item.gpa}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
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
            <span key={`${cat.id}-${i}`} className="rounded border px-2.5 py-1 text-xs font-medium" style={{ borderColor: EMERALD, color: CHARCOAL }}>
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
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold" style={{ color: CHARCOAL }}>{item.name}</span>
              {item.startDate && (
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: EMERALD }}>
                  {item.startDate} – {item.endDate || (resume.language === 'zh' ? '至今' : 'Present')}
                </span>
              )}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && <p className="mt-0.5 text-xs text-zinc-400">{resume.language === 'zh' ? '技术栈' : 'Tech'}: {item.technologies.join(', ')}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
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
              <span className="font-bold" style={{ color: CHARCOAL }}>{item.name}</span>
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
      <div className="flex flex-wrap gap-2">
        {items.map((item: any) => (
          <span key={item.id} className="rounded border px-2.5 py-1 text-xs font-medium" style={{ borderColor: EMERALD, color: CHARCOAL }}>
            {item.language}<span className="text-zinc-500"> — {item.proficiency}</span>
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
              <span className="text-sm font-bold" style={{ color: CHARCOAL }}>{item.name}</span>
              <span className="text-xs text-zinc-400">{'\u2B50'} {item.stars?.toLocaleString()}</span>
            </div>
            {item.language && <span className="text-xs text-zinc-400">{item.language}</span>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'custom') {
    const items = (content as CustomContent).items || [];
    return (
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold" style={{ color: CHARCOAL }}>{item.title}</span>
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

  if (content?.items) {
    return (
      <div className="space-y-2">
        {content.items.map((item: any) => (
          <div key={item.id}>
            <span className="text-sm font-medium" style={{ color: CHARCOAL }}>{item.name || item.title || item.language}</span>
            {item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
