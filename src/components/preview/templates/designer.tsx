'use client';

import type { Resume, PersonalInfoContent, SummaryContent, WorkExperienceContent, EducationContent, SkillsContent, ProjectsContent, CertificationsContent, LanguagesContent, CustomContent, GitHubContent } from '@/types/resume';
import { AvatarImage } from '../avatar-image';
import { degreeField, isSectionEmpty, md } from '../utils';
import { QrCodesPreview } from '../qr-codes-preview';

const CORAL = '#ff6b6b';

export function DesignerTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header - magazine style */}
      <div className="flex">
        <div className="flex-1 px-8 py-8">
          <h1 className="text-4xl font-black tracking-tight text-black">{pi.fullName || 'Your Name'}</h1>
          {pi.jobTitle && <p className="mt-1 text-lg font-light" style={{ color: CORAL }}>{pi.jobTitle}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
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
          </div>
        </div>
        {pi.avatar && (
          <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={128} wrapperClassName="w-32 shrink-0" />
        )}
      </div>

      <div className="h-1 w-full" style={{ background: CORAL }} />

      <div className="p-8">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <div key={section.id} className="mb-6" data-section>
              <h2 className="mb-3 text-xs font-black uppercase tracking-[0.3em]" style={{ color: CORAL }}>
                {section.title}
              </h2>
              <DesignerSectionContent section={section} resume={resume} />
            </div>
          ))}
      </div>
    </div>
  );
}

function DesignerSectionContent({ section, resume }: { section: any; resume: Resume }) {
  const content = section.content;
  if (!content) return null;

  if (section.type === 'summary') {
    return <p className="border-l-4 pl-4 text-sm leading-relaxed text-zinc-600" style={{ borderColor: CORAL }} dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />;
  }

  if (section.type === 'work_experience') {
    return (
      <div className="space-y-4">
        {(content.items || []).map((item: any) => (
          <div key={item.id} className="rounded-lg bg-zinc-50 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-black">{item.position}</h3>
              <span className="shrink-0 text-xs text-zinc-400">{item.startDate} – {item.endDate || (item.current ? (resume.language === 'zh' ? '至今' : 'Present') : '')}</span>
            </div>
            {item.company && <p className="text-sm font-medium" style={{ color: CORAL }}>{item.company}</p>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white" style={{ background: CORAL }}>{t}</span>
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
          <div key={item.id} className="rounded-lg bg-zinc-50 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold text-black">{degreeField(item.degree, item.field)}</span>
                {item.institution && <span className="text-sm text-zinc-500"> — {item.institution}</span>}
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
            <span key={`${cat.id}-${i}`} className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: CORAL }}>
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
          <div key={item.id} className="rounded-lg bg-zinc-50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-black">{item.name}</span>
              {item.startDate && <span className="shrink-0 text-xs text-zinc-400">{item.startDate} – {item.endDate || (resume.language === 'zh' ? '至今' : 'Present')}</span>}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white" style={{ background: CORAL }}>{t}</span>
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
          <div key={item.id} className="flex items-baseline justify-between rounded-lg bg-zinc-50 px-4 py-2">
            <div>
              <span className="text-sm font-semibold text-black">{item.name}</span>
              {item.issuer && <span className="text-sm text-zinc-500"> — {item.issuer}</span>}
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
          <span key={item.id} className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: CORAL }}>
            {item.language} — {item.proficiency}
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
          <div key={item.id} className="rounded-lg bg-zinc-50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-black">{item.name}</span>
              <span className="shrink-0 text-xs text-zinc-400">{'\u2B50'} {item.stars?.toLocaleString()}</span>
            </div>
            {item.language && <span className="text-xs font-medium" style={{ color: CORAL }}>{item.language}</span>}
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
          <div key={item.id} className="rounded-lg bg-zinc-50 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold text-black">{item.title}</span>
                {item.subtitle && <span className="text-sm text-zinc-500"> — {item.subtitle}</span>}
              </div>
              {item.date && <span className="shrink-0 text-xs text-zinc-400">{item.date}</span>}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
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
          <div key={item.id} className="rounded-lg bg-zinc-50 p-3">
            <span className="text-sm font-medium text-black">{item.name || item.title || item.language}</span>
            {item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
