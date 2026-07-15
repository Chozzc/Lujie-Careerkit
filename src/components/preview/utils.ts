import type { ResumeSection, SummaryContent, SkillsContent } from '@/types/resume';

/** Lightweight markdown → HTML for resume text fields (summary, descriptions, highlights).
 *  Supports: **bold**, `code`, line breaks, and "- item" lists. */
export function md(text: unknown): string {
  if (text == null) return '';
  let s = String(text);
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  if (!s.includes('\n')) return s;
  const lines = s.split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    const lm = line.match(/^[-–•]\s+(.*)/);
    if (lm) {
      if (!inList) { html += '<ul style="margin:2px 0;padding-left:1.5em;list-style-type:disc">'; inList = true; }
      html += `<li>${lm[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += (html && !html.endsWith('</ul>') ? '<br>' : '') + line;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

/** Join degree and field with separator */
export function degreeField(degree: string, field: string | undefined): string {
  if (!field) return degree;
  return `${degree} - ${field}`;
}

export function isSectionEmpty(section: ResumeSection): boolean {
  const content = section.content as unknown;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return true;

  if (section.type === 'summary' || section.type === 'self_evaluation') {
    return !(content as SummaryContent).text;
  }

  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories;
    return !categories?.length || categories.every((cat) => !cat.skills?.length);
  }

  // work_experience, education, projects, certifications, languages, custom
  if ('items' in content) {
    const items = (content as { items?: unknown }).items;
    return !Array.isArray(items) || items.length === 0;
  }

  return false;
}
