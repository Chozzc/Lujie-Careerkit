import QRCode from 'qrcode';
import type {
  PersonalInfoContent,
  QrCodeItem,
  ResumeSection,
  ProjectsContent,
  CertificationsContent,
  GitHubContent,
} from '@/types/resume';

/** Generate a QR code as an SVG string (works in both server and browser) */
export async function generateQrSvg(url: string, size = 80): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/** Ensure URL has https:// prefix */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Auto-detect QR-worthy URLs from all resume sections */
export function extractUrlsFromResume(sections: ResumeSection[]): QrCodeItem[] {
  const items: QrCodeItem[] = [];
  let id = 0;

  // Personal info: website, github, linkedin, customLinks
  const piSection = sections.find((s) => s.type === 'personal_info');
  if (piSection) {
    const pi = piSection.content as PersonalInfoContent;
    if (pi.website) {
      items.push({ id: `auto-${id++}`, label: 'Website', url: normalizeUrl(pi.website) });
    }
    if (pi.github) {
      items.push({ id: `auto-${id++}`, label: 'GitHub', url: normalizeUrl(pi.github) });
    }
    if (pi.linkedin) {
      items.push({ id: `auto-${id++}`, label: 'LinkedIn', url: normalizeUrl(pi.linkedin) });
    }
    if (pi.customLinks) {
      for (const link of pi.customLinks) {
        if (link.url) {
          items.push({ id: `auto-${id++}`, label: link.label || 'Link', url: normalizeUrl(link.url) });
        }
      }
    }
  }

  // Projects: project URLs
  for (const s of sections) {
    if (s.type === 'projects' && s.visible) {
      const proj = s.content as ProjectsContent;
      for (const item of proj.items || []) {
        if (item.url) {
          items.push({ id: `auto-${id++}`, label: item.name || 'Project', url: normalizeUrl(item.url) });
        }
      }
    }
  }

  // GitHub repos
  for (const s of sections) {
    if (s.type === 'github' && s.visible) {
      const gh = s.content as GitHubContent;
      for (const item of gh.items || []) {
        if (item.repoUrl) {
          items.push({ id: `auto-${id++}`, label: item.name || 'Repo', url: normalizeUrl(item.repoUrl) });
        }
      }
    }
  }

  // Certifications: cert URLs
  for (const s of sections) {
    if (s.type === 'certifications' && s.visible) {
      const certs = s.content as CertificationsContent;
      for (const item of certs.items || []) {
        if (item.url) {
          items.push({ id: `auto-${id++}`, label: item.name || 'Cert', url: normalizeUrl(item.url) });
        }
      }
    }
  }

  // Deduplicate by normalized URL
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
