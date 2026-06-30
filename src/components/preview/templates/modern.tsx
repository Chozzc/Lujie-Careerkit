'use client';

import type { Resume, PersonalInfoContent, SummaryContent, WorkExperienceContent, EducationContent, SkillsContent, ProjectsContent, CertificationsContent, LanguagesContent, CustomContent, GitHubContent } from '@/types/resume';
import { degreeField, isSectionEmpty, md } from '../utils';
import { AvatarImage } from '../avatar-image';
import { QrCodesPreview } from '../qr-codes-preview';

export function ModernTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;

  return (
    <div className="mx-auto max-w-[210mm] overflow-hidden bg-white shadow-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header with gradient */}
      <div
        className="relative px-10 py-8 text-white"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #e94560 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-6 right-20 h-24 w-24 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #e94560 0%, transparent 70%)' }}
        />

        <div className="relative flex items-center gap-6">
          {pi.avatar && (
            <AvatarImage src={pi.avatar} avatarStyle={resume.themeConfig?.avatarStyle} size={80} className="border-2 border-white/10" wrapperClassName="shrink-0 p-[2px]" wrapperStyle={{ background: 'linear-gradient(135deg, #e94560, #0f3460)' }} />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{pi.fullName || 'Your Name'}</h1>
            {pi.jobTitle && (
              <p className="mt-1.5 text-base font-light tracking-wide" style={{ color: '#e94560' }}>
                {pi.jobTitle}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-zinc-300">
              {[pi.age, pi.politicalStatus, pi.gender, pi.ethnicity, pi.hometown, pi.maritalStatus, pi.yearsOfExperience, pi.educationLevel, pi.email, pi.phone, pi.wechat, pi.location, pi.website].filter(Boolean).map((item, i, arr) => (
                <span key={i} className="flex items-center gap-1.5">
                  {item}
                  {i < arr.length - 1 && <span className="text-zinc-500">|</span>}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-0 h-[3px] w-full"
          style={{ background: 'linear-gradient(90deg, #e94560 0%, #0f3460 60%, transparent 100%)' }}
        />
      </div>

      <div className="p-8 pt-6">
        {resume.sections
          .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
          .map((section) => (
            <div key={section.id} className="mb-6" data-section>
              <h2 className="mb-3 flex items-center gap-2.5 text-sm font-bold uppercase tracking-wider" style={{ color: '#e94560' }}>
                <span className="h-[3px] w-7 rounded-full" style={{ background: 'linear-gradient(90deg, #e94560, #0f3460)' }} />
                {section.title}
              </h2>
              <ModernSectionContent section={section} lang={resume.language} />
            </div>
          ))}
      </div>
    </div>
  );
}

function ModernSectionContent({ section, lang }: { section: any; lang?: string }) {
  const content = section.content;
  if (!content) return null;

  if (section.type === 'summary') {
    return <p className="text-sm leading-relaxed text-zinc-600" dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />;
  }

  if (section.type === 'work_experience') {
    return (
      <div className="space-y-4">
        {(content.items || []).map((item: any) => (
          <div key={item.id} className="border-l-2 pl-4" style={{ borderColor: '#e94560' }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">{item.position}</h3>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500">
                {item.startDate} - {item.endDate || (item.current ? (lang === 'zh' ? '至今' : 'Present') : '')}
              </span>
            </div>
            {item.company && <p className="text-sm" style={{ color: '#e94560' }}>{item.company}</p>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">{t}</span>
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
          <div key={item.id} className="border-l-2 pl-4" style={{ borderColor: '#0f3460' }}>
            <h3 className="text-sm font-semibold text-zinc-800">{item.institution}</h3>
            <p className="text-sm text-zinc-600">{degreeField(item.degree, item.field)}</p>
            <span className="text-xs text-zinc-400">{item.startDate} - {item.endDate || (lang === 'zh' ? '至今' : 'Present')}</span>
            {item.gpa && <p className="mt-0.5 text-xs text-zinc-500">GPA: {item.gpa}</p>}
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
            <span
              key={`${cat.id || 'cat'}-${i}`}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors"
            >
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
          <div key={item.id} className="border-l-2 pl-4" style={{ borderColor: '#e94560' }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">{item.name}</h3>
              {item.startDate && (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500">
                  {item.startDate} - {item.endDate || (lang === 'zh' ? '至今' : 'Present')}
                </span>
              )}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">{t}</span>
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

  if (section.type === 'github') {
    const items = (content as GitHubContent).items || [];
    return (
      <div className="space-y-4">
        {items.map((item: any) => (
          <div key={item.id} className="border-l-2 pl-4" style={{ borderColor: '#e94560' }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">{item.name}</h3>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500">{item.stars?.toLocaleString()}</span>
            </div>
            {item.language && <span className="text-xs text-zinc-500">{item.language}</span>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
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
          <div key={item.id} className="flex items-baseline justify-between border-l-2 pl-4" style={{ borderColor: '#0f3460' }}>
            <div>
              <span className="text-sm font-semibold text-zinc-800">{item.name}</span>
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
          <span key={item.id} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
            {item.language} <span className="text-zinc-400">— {item.proficiency}</span>
          </span>
        ))}
      </div>
    );
  }

  if (section.type === 'custom') {
    const items = (content as CustomContent).items || [];
    return (
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className="border-l-2 pl-4" style={{ borderColor: '#e94560' }}>
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-800">{item.title}</h3>
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
          <div key={item.id} className="border-l-2 border-zinc-200 pl-4">
            <span className="text-sm font-medium text-zinc-700">{item.name || item.title || item.language}</span>
            {item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
