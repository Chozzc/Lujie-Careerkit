'use client';
import { resumeEducationDates, resumeEducationGpa, resumeEducationHeading, resumeDegree, resumeField } from '../resume-field';
import { isResumeFieldBold } from '@/lib/resume-inline-layout';

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
import { AvatarImage } from '../avatar-image';
import { EntryLogo } from '../entry-logo';
import { isSectionEmpty, md } from '../utils';
import { QrCodesPreview } from '../qr-codes-preview';

const PRIMARY = '#1e293b';
const AMBER = '#f59e0b';

export function MetroTemplate({ resume }: { resume: Resume }) {
  const personalInfo = resume.sections.find((s) => s.type === 'personal_info');
  const pi = (personalInfo?.content || {}) as PersonalInfoContent;

  const contacts = [pi.age, pi.politicalStatus, pi.gender, pi.ethnicity, pi.hometown, pi.maritalStatus, pi.yearsOfExperience, pi.educationLevel, pi.email, pi.phone, pi.wechat, pi.location, pi.website].filter(Boolean);

  return (
    <div className="mx-auto max-w-[210mm] bg-white shadow-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-5">
        {pi.avatar && (
          <AvatarImage
            src={pi.avatar}
            avatarStyle={resume.themeConfig?.avatarStyle}
            size={64}
            className="shrink-0"
            style={{ border: `3px solid ${AMBER}` }}
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight" style={{ color: PRIMARY }}>{pi.fullName || 'Your Name'}</h1>
          {pi.jobTitle && (
            <p className="mt-0.5 text-sm font-semibold" style={{ color: AMBER }}>{pi.jobTitle}</p>
          )}
          {contacts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
              {contacts.map((c, i) => (
                <span key={i} className="px-2 py-0.5" style={{ backgroundColor: '#f8fafc', borderLeft: `2px solid ${AMBER}` }}>
                  {c}
                </span>
              ))}
              {pi.linkedin && (
                <span className="px-2 py-0.5" style={{ backgroundColor: '#f8fafc', borderLeft: `2px solid ${AMBER}` }}>
                  {pi.linkedin}
                </span>
              )}
              {pi.github && (
                <span className="px-2 py-0.5" style={{ backgroundColor: '#f8fafc', borderLeft: `2px solid ${AMBER}` }}>
                  {pi.github}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-6 h-1" style={{ backgroundColor: PRIMARY }} />

      {/* Sections */}
      {resume.sections
        .filter((s) => s.visible && s.type !== 'personal_info' && !isSectionEmpty(s))
        .map((section) => (
          <div key={section.id} className="mb-6" data-section>
            <div className="mb-3 flex items-center gap-2">
              <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: PRIMARY }}>
                {section.title}
              </div>
              <div className="h-0.5 flex-1" style={{ backgroundColor: AMBER }} />
            </div>
            <MetroSectionContent section={section} resume={resume} />
          </div>
        ))}
    </div>
  );
}

function MetroSectionContent({ section, resume }: { section: any; resume: Resume }) {
  const content = section.content;
  if (!content) return null;

  if (section.type === 'summary') {
    return (
      <p className="border-l-3 pl-4 text-sm leading-relaxed text-zinc-600" style={{ borderColor: AMBER }} dangerouslySetInnerHTML={{ __html: md((content as SummaryContent).text) }} />
    );
  }

  if (section.type === 'work_experience') {
    const items = (content as WorkExperienceContent).items || [];
    return (
      <div className="space-y-4">
        {items.map((item: any) => (
          <div key={item.id} className="border-l-3 pl-4" style={{ borderColor: AMBER }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold" style={{ color: PRIMARY }}><EntryLogo src={item.logo} alt={item.company || item.position} className="me-1 align-middle" />{item.position}</h3>
              <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: PRIMARY }}>
                {item.startDate} - {item.endDate || (item.current ? (resume.language === 'zh' ? '至今' : 'Present') : '')}
              </span>
            </div>
            {item.company && <p className="text-sm font-semibold" style={{ color: AMBER }}>{item.company}</p>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {item.highlights.map((h: string, i: number) => (
                  <li key={i} className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(h) }} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'education') {
    const items = (content as EducationContent).items || [];
    return (
      <div data-education-section data-resume-compact-spacing={content.inlineLayout === true || undefined} className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className="border-l-3 pl-4" style={{ borderColor: AMBER }}>
            <div className="flex items-baseline justify-between">
              {resumeEducationHeading(item, content.inlineLayout === true, <h3 className="text-sm font-bold" style={{ color: PRIMARY }}>{resumeField(section, "institution", item.institution)}</h3>, <p className="text-sm text-zinc-600">{resumeDegree(section, item.degree, item.field)}</p>, resumeEducationGpa(section, item.gpa, true, { className: "text-xs text-zinc-500" }), true)}
              <span className="text-xs text-zinc-400">{resumeEducationDates(section, item.startDate, item.endDate, " - ", resume.language === 'zh' ? '至今' : 'Present')}</span>
            </div>
            {content.inlineLayout !== true && <p className="text-sm text-zinc-600">{resumeDegree(section, item.degree, item.field)}</p>}
            {content.inlineLayout !== true && item.gpa && <p className="text-xs text-zinc-500">{resumeEducationGpa(section, item.gpa)}</p>}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {item.highlights.map((h: string, i: number) => (
                  <li key={i} className="text-sm text-zinc-600" data-resume-field-bold={isResumeFieldBold(section, "highlights") || undefined} dangerouslySetInnerHTML={{ __html: md(h) }} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories || [];
    return (
      <div className="space-y-3">
        {categories.map((cat: any) => (
          <div key={cat.id}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>{cat.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {(cat.skills || []).map((skill: string, i: number) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: AMBER }}
                >
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
          <div key={item.id} className="border-l-3 pl-4" style={{ borderColor: AMBER }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold" style={{ color: PRIMARY }}><EntryLogo src={item.logo} alt={item.name} className="me-1 align-middle" />{item.name}</h3>
              {item.startDate && (
                <span className="text-xs text-zinc-400">
                  {item.startDate} - {item.endDate || (resume.language === 'zh' ? '至今' : 'Present')}
                </span>
              )}
            </div>
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
            {item.technologies?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.technologies.map((t: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {item.highlights?.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {item.highlights.map((h: string, i: number) => (
                  <li key={i} className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(h) }} />
                ))}
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
      <div data-certifications-section data-resume-compact-list={content.inlineLayout === true || undefined} className="space-y-1.5">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-baseline justify-between border-l-3 pl-4" style={{ borderColor: AMBER }}>
            <span className="text-sm font-bold" style={{ color: PRIMARY }}>{resumeField(section, "name", item.name)}</span>
            {(item.issuer || item.date) && <span className="text-xs text-zinc-500">{resumeField(section, "issuer", item.issuer)}{item.issuer && item.date ? ' | ' : ''}{resumeField(section, "date", item.date)}</span>}
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
          <div key={item.id} className="flex items-center gap-2 px-3 py-1" style={{ backgroundColor: '#f8fafc', borderLeft: `3px solid ${AMBER}` }}>
            <span className="text-sm font-semibold" style={{ color: PRIMARY }}>{item.language}</span>
            <span className="text-xs text-zinc-400">{item.proficiency}</span>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'github') {
    const items = (content as GitHubContent).items || [];
    return (
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className="border-l-3 pl-4" style={{ borderColor: AMBER }}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold" style={{ color: PRIMARY }}>{item.name}</span>
              <span className="text-xs text-zinc-400">{'\u2B50'} {item.stars?.toLocaleString()}</span>
            </div>
            {item.language && <span className="text-xs" style={{ color: AMBER }}>{item.language}</span>}
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
          <div key={item.id} className="border-l-3 pl-4" style={{ borderColor: AMBER }}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold" style={{ color: PRIMARY }}>{item.title}</h3>
              {item.date && <span className="text-xs text-zinc-400">{item.date}</span>}
            </div>
            {item.subtitle && <p className="text-sm text-zinc-500">{item.subtitle}</p>}
            {item.description && <p className="mt-1 text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
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
          <div key={item.id} className="border-l-3 pl-4" style={{ borderColor: AMBER }}>
            <span className="text-sm font-semibold" style={{ color: PRIMARY }}>{item.name || item.title || item.language}</span>
            {item.description && <p className="text-sm text-zinc-600" dangerouslySetInnerHTML={{ __html: md(item.description) }} />}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
