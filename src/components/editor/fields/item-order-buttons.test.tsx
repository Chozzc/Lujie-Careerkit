import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../messages/en.json';
import zh from '../../../../messages/zh-CN.json';
import { Button } from '@/components/ui/button';
import { contentToJadeResume, jadeResumeToContent } from '@/lib/resume-adapter';
import { normalizeResumeContent, resumeContentFromText } from '@/lib/resume-content';
import { useResumeStore } from '@/stores/resume-store';
import type { ResumeSection, WorkExperienceContent } from '@/types/resume';
import { ProjectsSection } from '../sections/projects';
import { WorkExperienceSection } from '../sections/work-experience';
import { EducationSection } from '../sections/education';
import { CertificationsSection } from '../sections/certifications';
import { CustomSection } from '../sections/custom-section';
import { SkillsSection } from '../sections/skills';
import { LanguagesSection } from '../sections/languages';
import { GitHubSection } from '../sections/github';
import { QrCodesSection } from '../sections/qr-codes';
import { EditableList } from './editable-list';
import { ItemOrderButtons } from './item-order-buttons';

const captured = vi.hoisted(() => ({ buttons: [] as Array<ComponentProps<typeof Button>> }));
vi.mock('@/components/ui/button', async (original) => {
  const actual = await original<typeof import('@/components/ui/button')>();
  return { ...actual, Button: (props: ComponentProps<typeof Button>) => {
    captured.buttons.push(props);
    return <actual.Button {...props} />;
  } };
});

function render(children: React.ReactNode, locale = 'en') {
  captured.buttons = [];
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone="Asia/Shanghai">
      {children}
    </NextIntlClientProvider>,
  );
}

function click(label: string) {
  const button = captured.buttons.find((button) => button['aria-label'] === label)!;
  expect(button).toBeDefined();
  button.onClick!({} as never);
}

const names = ['A', 'B', 'C'];
const work: WorkExperienceContent = { items: names.map((name) => ({
  id: name, company: name, position: name, startDate: '2024-01', endDate: '2025-01',
  current: false, description: name, technologies: [name], highlights: [name],
})) };
const cases = [
  { type: 'projects', Editor: ProjectsSection, content: { items: names.map((name) => ({ id: name, name, description: name, technologies: [name], highlights: [name] })) } },
  { type: 'work_experience', Editor: WorkExperienceSection, content: work },
  { type: 'internship_experience', Editor: WorkExperienceSection, content: work },
  { type: 'education', Editor: EducationSection, content: { items: names.map((name) => ({ id: name, institution: name, degree: '', field: '', startDate: '', endDate: '', highlights: [name] })) } },
  { type: 'certifications', Editor: CertificationsSection, content: { items: names.map((name) => ({ id: name, name, issuer: '', date: '' })) } },
  { type: 'custom', Editor: CustomSection, content: { items: names.map((name) => ({ id: name, title: name, description: name })) } },
  { type: 'skills', Editor: SkillsSection, content: { categories: names.map((name) => ({ id: name, name, skills: [name] })) } },
  { type: 'languages', Editor: LanguagesSection, content: { items: names.map((name) => ({ id: name, language: name, proficiency: name })) } },
  { type: 'github', Editor: GitHubSection, content: { items: names.map((name) => ({ id: name, name, repoUrl: `https://github.com/example/${name}`, stars: 0, language: '', description: name })) } },
  { type: 'qr_codes', Editor: QrCodesSection, content: { items: names.map((name) => ({ id: name, label: name, url: `https://example.com/${name}` })) } },
];

afterEach(() => {
  useResumeStore.getState().reset();
  vi.useRealTimers();
});

describe('resume entry ordering', () => {
  it.each(cases)('moves $type entries through section updates, saving and reopening', async ({ type, Editor, content }) => {
    vi.useFakeTimers();
    const resume = contentToJadeResume(resumeContentFromText('Example', 'Example'));
    const section: ResumeSection = { ...resume.sections[0], id: type, type, title: type, content };
    resume.sections = [section];
    const store = useResumeStore.getState();
    store.setResume(structuredClone(resume));
    const persist = vi.fn(async () => {});
    store.setPersistence(persist);
    const onUpdate = (patch: Partial<ResumeSection['content']>) => store.updateSection(type, patch);

    render(<Editor section={useResumeStore.getState().sections[0]} onUpdate={onUpdate} />);
    click(`Move ${type} item 1 down`);
    const changed = useResumeStore.getState().sections[0];
    const key = type === 'skills' ? 'categories' : 'items';
    const entries = (changed.content as unknown as Record<string, Array<{ id: string }>>)[key];
    expect(entries.map((entry) => entry.id)).toEqual(['B', 'A', 'C']);
    expect((section.content as unknown as Record<string, Array<{ id: string }>>)[key].map((entry) => entry.id)).toEqual(names);
    expect(useResumeStore.getState().isDirty).toBe(true);

    render(<Editor section={changed} onUpdate={onUpdate} />);
    click(`Move ${type} item 3 up`);
    expect(await store.save('manual')).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    const saved = (persist.mock.calls[0] as unknown as [typeof resume])[0];
    const reopened = contentToJadeResume(normalizeResumeContent(jadeResumeToContent(saved)));
    const original = (content as unknown as Record<string, unknown[]>)[key];
    expect(reopened.sections[0].content).toEqual({ [key]: [original[1], original[2], original[0]] });
  });

  it('disables the ends without wrapping, and hides controls for fewer than two entries', () => {
    const onChange = vi.fn();
    render(<ItemOrderButtons label="Projects" items={names} index={0} onChange={onChange} />);
    expect(captured.buttons[0].disabled).toBe(true);
    click('Move Projects item 1 up');
    expect(onChange).not.toHaveBeenCalled();
    render(<ItemOrderButtons label="Projects" items={names} index={2} onChange={onChange} />);
    expect(captured.buttons[1].disabled).toBe(true);
    click('Move Projects item 3 down');
    expect(onChange).not.toHaveBeenCalled();
    expect(render(<ItemOrderButtons label="Projects" items={[]} index={0} onChange={onChange} />)).toBe('');
    expect(render(<ItemOrderButtons label="Projects" items={['A']} index={0} onChange={onChange} />)).toBe('');
  });

  it('reorders highlights and keywords through the shared list editor', () => {
    const onChange = vi.fn();
    render(<EditableList label="Highlights" items={names} onChange={onChange} />);
    click('Move Highlights item 2 up');
    expect(onChange).toHaveBeenCalledWith(['B', 'A', 'C']);
    expect(names).toEqual(['A', 'B', 'C']);
  });

  it('keeps an unfinished project and empty highlight lines in place after moving and reopening', () => {
    const resume = contentToJadeResume(resumeContentFromText('Example', 'Example'));
    const section = { ...resume.sections[0], type: 'projects', title: 'Projects', content: { items: [
      { id: 'complete', name: 'Complete', description: '', technologies: ['SQL', ''], highlights: ['Evidence', ''] },
      { id: 'unfinished', name: '', description: '', technologies: [], highlights: [] },
    ] } };
    const onUpdate = vi.fn();
    render(<ProjectsSection section={section} onUpdate={onUpdate} />);
    click('Move Projects item 2 up');
    resume.sections = [{ ...section, content: onUpdate.mock.calls[0][0] }];
    const reopened = contentToJadeResume(normalizeResumeContent(jadeResumeToContent(resume)));
    expect(reopened.sections[0].content).toEqual(resume.sections[0].content);
  });

  it.each(['zh-CN', 'en'])('renders named non-submit controls in %s', (locale) => {
    const markup = render(<ItemOrderButtons label="Projects" items={names} index={1} onChange={() => {}} />, locale);
    expect(markup).toContain(locale === 'en' ? 'Move Projects item 2 up' : '上移Projects第 2 项');
    expect(markup).toContain(locale === 'en' ? 'Move Projects item 2 down' : '下移Projects第 2 项');
    expect(captured.buttons.every((button) => button.type === 'button')).toBe(true);
  });
});
