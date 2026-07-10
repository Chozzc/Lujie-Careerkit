'use client';

import { LogoMark } from '@/components/shared/logo-mark';

interface EntryLogoProps {
  src?: string;
  alt?: string;
  className?: string;
}

export function EntryLogo({ src, alt, className = '' }: EntryLogoProps) {
  if (!src) return null;
  return (
    <span data-entry-logo className={`inline-flex h-7 w-7 shrink-0 items-center justify-center text-zinc-500 ${className}`}>
      <LogoMark value={src} alt={alt ? `${alt} logo` : ''} className="size-full object-contain" iconClassName="size-full" />
    </span>
  );
}
