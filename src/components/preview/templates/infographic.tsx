'use client';

import type { Resume, PersonalInfoContent, SummaryContent, WorkExperienceContent, EducationContent, SkillsContent, ProjectsContent, CertificationsContent, LanguagesContent, CustomContent, GitHubContent } from '@/types/resume';
import { AvatarImage } from '../avatar-image';
import { degreeField, isSectionEmpty, md } from '../utils';
import { QrCodesPreview } from '../qr-codes-preview';

// intentional: infographic template visual identity — rotating rainbow palette; #ec4899 (pink) is one of 6 intentional accent colors
const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

export function InfographicTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="relative overflow-hidden px-8 py-8" style={{ background: 'linear-gradient(135deg, #1e40af, #7c3aed)' }}>
        <div className="relative flex items-center gap-5">
          {pi.avatar && (
            <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={80} className="shrink-0" style={{ border: '3px solid rgba(255,255,255,0.3)' }} />
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{pi.fullName || 'Your Name'}</h1>
            {pi.jobTitle && <p className="mt-1 text-base text-white/70">{pi.jobTitle}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/60">
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
          .map((section, idx) => (
            <div key={section.id} className="mb-6" data-section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] text-white" style={{ background: COLORS[idx % COLORS.length] }}>
                  {idx + 1}
                </span>
                <span style={{ color: COLORS[idx % COLORS.length] }}>{section.title}</span>
              </h2>
              <InfographicSectionContent section={section} colorIndex={idx} resume={resume} />
            </div>
          ))}
      </div>
    </div>
  );
}

function InfographicSectionContent({ section, colorIndex, resume }: { section: any; colorIndex: number; resume: Resume }) {
  const content = section.content;
  if (!content) return null;
  const color = COLORS[colorIndex % COLORS.length];

  if (section.type === 'summary') {
    return <p className="rounded-lg border-l-4 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-600" style={{ borderColor: color }} dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />;
  }

  if (section.type === 'work_experience') {
    return (
      <div className="space-y-4">
        {(content.items || []).map((item: any) => (
          <div key={item.id} className="rounded-lg border border-zinc-100 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-zinc-800">{item.position}</h3>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: color }}>
                {item.startDate} – {item.endDate || (item.current ? (resume.language === 'zh' ? '至今' : 'Present') : '')}
              </span>
            </div>
            {item.company && <p className="text-sm" style={{ color }}>{item.company}</p>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: color, opacity: 0.8 }}>
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
          <div key={item.id} className="rounded-lg border border-zinc-100 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold text-zinc-800">{degreeField(item.degree, item.field)}</span>
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
      <div className="space-y-2">
        {(content.categories || []).map((cat: any, ci: number) => (
          <div key={cat.id}>
            <p className="mb-1 text-xs font-bold text-zinc-500">{cat.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {(cat.skills || []).map((skill: string, i: number) => (
                <span key={i} className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ background: COLORS[(colorIndex + ci) % COLORS.length] }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'projects') {
    const items = (content as ProjectsContent).items || [];
    return (
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className="rounded-lg border border-zinc-100 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold" style={{ color }}>{item.name}</h3>
              {item.startDate && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: color }}>
                  {item.startDate} – {item.endDate || (resume.language === 'zh' ? '至今' : 'Present')}
                </span>
              )}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: color, opacity: 0.8 }}>
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
          <div key={item.id} className="flex items-baseline justify-between rounded-lg border border-zinc-100 p-3">
            <div>
              <span className="text-sm font-bold" style={{ color }}>{item.name}</span>
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
        {items.map((item: any, i: number) => (
          <span key={item.id} className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: COLORS[(colorIndex + i) % COLORS.length] }}>
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
          <div key={item.id} className="rounded-lg border border-zinc-100 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold" style={{ color }}>{item.name}</span>
              <span className="shrink-0 text-xs text-zinc-400">{'\u2B50'} {item.stars?.toLocaleString()}</span>
            </div>
            {item.language && <span className="text-xs" style={{ color }}>{item.language}</span>}
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
          <div key={item.id} className="rounded-lg border border-zinc-100 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-sm font-bold" style={{ color }}>{item.title}</span>
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
          <div key={item.id} className="rounded-lg border border-zinc-100 p-3">
            <span className="text-sm font-medium text-zinc-800">{item.name || item.title || item.language}</span>
            {item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
