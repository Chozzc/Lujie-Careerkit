'use client';

/* eslint-disable @next/next/no-img-element */

import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  Code2,
  Cpu,
  Globe2,
  GraduationCap,
  Landmark,
  Mail,
  Palette,
  Phone,
  Rocket,
  ShieldCheck,
  Trophy,
  type LucideIcon,
  UsersRound,
} from 'lucide-react';

export const logoIconPresets: Array<{ id: string; Icon: LucideIcon }> = [
  { id: 'building', Icon: Building2 },
  { id: 'briefcase', Icon: BriefcaseBusiness },
  { id: 'code', Icon: Code2 },
  { id: 'cpu', Icon: Cpu },
  { id: 'chart', Icon: ChartNoAxesCombined },
  { id: 'palette', Icon: Palette },
  { id: 'rocket', Icon: Rocket },
  { id: 'users', Icon: UsersRound },
  { id: 'landmark', Icon: Landmark },
  { id: 'graduation-cap', Icon: GraduationCap },
  { id: 'book-open', Icon: BookOpen },
  { id: 'trophy', Icon: Trophy },
  { id: 'shield-check', Icon: ShieldCheck },
  { id: 'globe', Icon: Globe2 },
  { id: 'mail', Icon: Mail },
  { id: 'phone', Icon: Phone },
];

export function LogoMark({
  value,
  alt,
  className = '',
  iconClassName = 'h-4 w-4',
}: {
  value?: string;
  alt?: string;
  className?: string;
  iconClassName?: string;
}) {
  const presetId = value?.startsWith('icon:') ? value.slice(5) : '';
  const preset = logoIconPresets.find((item) => item.id === presetId);

  if (preset) {
    const Icon = preset.Icon;
    return (
      <span className={className} aria-label={alt}>
        <Icon className={iconClassName} aria-hidden="true" />
      </span>
    );
  }

  if (!value) return null;
  return <img src={value} alt={alt ?? ''} className={className} loading="lazy" />;
}
